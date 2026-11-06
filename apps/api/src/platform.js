// Lógica pura del panel de plataforma: identidad del administrador, estado y
// plan de los negocios, validación del PATCH y cálculos de resumen. Sin
// Express ni Firestore para poder probarla con dobles.

import { addDays, isValidTimeZone, utcToLocalDate } from "./timezone.js";

export const TENANT_STATUSES = Object.freeze(["active", "suspended"]);
export const TENANT_PLANS = Object.freeze(["trial", "basico", "pro"]);
export const TENANT_NOTES_MAX_LENGTH = 300;
export const FALLBACK_TIME_ZONE = "America/Bogota";

// PLATFORM_ADMIN_EMAILS: lista separada por comas, sin distinguir mayúsculas.
export function parsePlatformAdminEmails(value) {
  if (typeof value !== "string") return [];
  const emails = value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(emails)];
}

export function isPlatformAdminEmail(email, env = process.env) {
  if (typeof email !== "string" || email.trim() === "") return false;
  return parsePlatformAdminEmails(env?.PLATFORM_ADMIN_EMAILS).includes(email.trim().toLowerCase());
}

export function resolveTenantStatus(tenant) {
  return tenant?.status === "suspended" ? "suspended" : "active";
}

export function resolveTenantPlan(tenant) {
  return TENANT_PLANS.includes(tenant?.plan) ? tenant.plan : "trial";
}

export function resolveTenantNotes(tenant) {
  return typeof tenant?.notes === "string" ? tenant.notes : "";
}

export function resolveTenantUsage(tenant) {
  const usage = tenant?.usage && typeof tenant.usage === "object" ? tenant.usage : {};
  return {
    agentMessages: integerOrZero(usage.agentMessages),
    inputTokens: integerOrZero(usage.inputTokens),
    outputTokens: integerOrZero(usage.outputTokens),
    updatedAt: toIsoString(usage.updatedAt),
  };
}

// Validación pura de PATCH /platform/tenants/:id. Objeto vacío = sin cambios.
export function validateTenantAdminUpdate(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const value = {};

  if (input.status !== undefined) {
    if (!TENANT_STATUSES.includes(input.status)) {
      return invalid("invalid_status", "El estado debe ser \"active\" o \"suspended\".");
    }
    value.status = input.status;
  }

  if (input.plan !== undefined) {
    if (!TENANT_PLANS.includes(input.plan)) {
      return invalid("invalid_plan", "El plan debe ser \"trial\", \"basico\" o \"pro\".");
    }
    value.plan = input.plan;
  }

  if (input.notes !== undefined) {
    if (typeof input.notes !== "string") {
      return invalid("invalid_notes", "Las notas deben ser texto.");
    }
    const notes = input.notes.trim();
    if (notes.length > TENANT_NOTES_MAX_LENGTH) {
      return invalid("invalid_notes", `Las notas no pueden superar ${TENANT_NOTES_MAX_LENGTH} caracteres.`);
    }
    value.notes = notes;
  }

  return { ok: true, value };
}

// Cálculo puro del resumen con dobles; el servicio solo aporta los agregados.
export function buildPlatformSummary({
  tenantRows = [],
  appointmentsLast7Days = 0,
  customersTotal = 0,
  agentMessagesLast30Days = 0,
} = {}) {
  const tenants = { total: tenantRows.length, active: 0, suspended: 0, trial: 0 };
  for (const tenant of tenantRows) {
    if (resolveTenantStatus(tenant) === "suspended") tenants.suspended += 1;
    else tenants.active += 1;
    if (resolveTenantPlan(tenant) === "trial") tenants.trial += 1;
  }
  return {
    tenants,
    appointmentsLast7Days: integerOrZero(appointmentsLast7Days),
    customersTotal: integerOrZero(customersTotal),
    agentMessagesLast30Days: integerOrZero(agentMessagesLast30Days),
  };
}

// Mensajes de agente de los últimos 30 días (incluye hoy): suma usageDaily.
export function sumUsageLast30Days(tenant, now = new Date()) {
  const timeZone = isValidTimeZone(tenant?.timeZone) ? tenant.timeZone : FALLBACK_TIME_ZONE;
  const today = utcToLocalDate(now, timeZone);
  const cutoff = addDays(today, -29);
  const daily = tenant?.usageDaily && typeof tenant.usageDaily === "object" ? tenant.usageDaily : null;

  if (daily) {
    let total = 0;
    for (const [date, entry] of Object.entries(daily)) {
      if (typeof date !== "string" || date < cutoff || date > today) continue;
      total += integerOrZero(entry?.agentMessages);
    }
    return total;
  }

  return integerOrZero(tenant?.usage?.agentMessages);
}

// Filtro puro de la lista: estado y búsqueda por nombre, slug o correo del dueño.
export function filterPlatformTenants(rows, { query = "", status = "" } = {}) {
  const needle = normalizePlatformText(query);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (status !== "" && resolveTenantStatus(row) !== status) return false;
    if (needle === "") return true;
    return [row?.name, row?.slug, row?.ownerEmail]
      .some((value) => normalizePlatformText(value).includes(needle));
  });
}

export function normalizePlatformText(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function statusFilterIsValid(status) {
  return status === "" || status === undefined || status === null || TENANT_STATUSES.includes(status);
}

function integerOrZero(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function toIsoString(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

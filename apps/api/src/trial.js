// Prueba (trial) de los negocios: duración configurable y días restantes
// calculados en la zona horaria del negocio.

import { resolveTenantPlan } from "./platform.js";
import { isValidTimeZone, utcToLocalDate } from "./timezone.js";

export const DEFAULT_TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const FALLBACK_TIME_ZONE = "America/Bogota";

export function resolveTrialDays(env = process.env) {
  const value = Number(env?.TRIAL_DAYS);
  return Number.isInteger(value) && value > 0 && value <= 365 ? value : DEFAULT_TRIAL_DAYS;
}

export function trialEndsAtFromNow(days = DEFAULT_TRIAL_DAYS, now = new Date()) {
  return new Date(now.getTime() + days * DAY_MS);
}

// Días naturales restantes: 0 si ya venció, null si el negocio no tiene fecha.
export function computeTrialDaysLeft(trialEndsAt, now = new Date(), timeZone = FALLBACK_TIME_ZONE) {
  const endMs = toMillis(trialEndsAt);
  if (endMs === null) return null;

  const tz = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  const endLocal = utcToLocalDate(new Date(endMs), tz);
  const nowLocal = utcToLocalDate(now, tz);
  const diff = Math.round((localDateToUtcMs(endLocal) - localDateToUtcMs(nowLocal)) / DAY_MS);
  return diff > 0 ? diff : 0;
}

export function serializeTrial(tenant, now = new Date()) {
  const timeZone = isValidTimeZone(tenant?.timeZone) ? tenant.timeZone : FALLBACK_TIME_ZONE;
  return {
    plan: resolveTenantPlan(tenant),
    trialEndsAt: toIsoString(tenant?.trialEndsAt),
    trialDaysLeft: computeTrialDaysLeft(tenant?.trialEndsAt, now, timeZone),
  };
}

function localDateToUtcMs(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().getTime();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function toIsoString(value) {
  const millis = toMillis(value);
  return millis === null ? null : new Date(millis).toISOString();
}

// La prueba vence cuando la fecha de fin ya pasó. Negocios sin fecha (antiguos o
// con plan de pago) nunca se consideran vencidos por esta regla.
export function isTrialExpired(tenant, now = new Date()) {
  const endMs = toMillis(tenant?.trialEndsAt);
  if (endMs === null) return false;
  return endMs <= now.getTime();
}

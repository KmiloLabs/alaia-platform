// Catálogo de servicios: validación pura y operaciones CRUD. No importa
// Firestore: recibe un repositorio (service-repository.js en producción, un
// doble en memoria en las pruebas unitarias).

import { MAX_DURATION_MINUTES, MIN_DURATION_MINUTES } from "./availability.js";

export const SERVICE_NAME_MIN_LENGTH = 2;
export const SERVICE_NAME_MAX_LENGTH = 80;
export const SERVICE_DESCRIPTION_MAX_LENGTH = 300;
export const SERVICE_CATEGORY_MAX_LENGTH = 40;
export const SERVICE_PRICE_MIN_COP = 0;
export const SERVICE_PRICE_MAX_COP = 10_000_000;
export const MAX_ACTIVE_SERVICES_FOR_AGENT = 20;

const SERVICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Clave de comparación de nombres: sin mayúsculas, sin acentos y sin espacios extra.
export function normalizeServiceName(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidServiceId(serviceId) {
  return typeof serviceId === "string" && SERVICE_ID_PATTERN.test(serviceId);
}

// partial=true para PATCH: valida solo los campos enviados (objeto vacío = no-op).
export function validateServiceInput(body, { partial = false } = {}) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const value = {};

  if (!partial || input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length < SERVICE_NAME_MIN_LENGTH || name.length > SERVICE_NAME_MAX_LENGTH) {
      return invalid("invalid_service_name", "El nombre del servicio debe tener entre 2 y 80 caracteres.");
    }
    value.name = name;
  }

  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") {
      return invalid("invalid_active", "El estado activo debe ser true o false.");
    }
    value.active = input.active;
  }

  if (input.description !== undefined) {
    if (typeof input.description !== "string") {
      return invalid("invalid_service_description", "La descripción debe ser texto.");
    }
    const description = input.description.trim();
    if (description.length > SERVICE_DESCRIPTION_MAX_LENGTH) {
      return invalid("invalid_service_description", "La descripción no puede superar 300 caracteres.");
    }
    value.description = description;
  } else if (!partial) {
    value.description = "";
  }

  if (input.category !== undefined) {
    if (typeof input.category !== "string") {
      return invalid("invalid_service_category", "La categoría debe ser texto.");
    }
    const category = input.category.trim();
    if (category.length > SERVICE_CATEGORY_MAX_LENGTH) {
      return invalid("invalid_service_category", "La categoría no puede superar 40 caracteres.");
    }
    value.category = category;
  } else if (!partial) {
    value.category = "";
  }

  if (!partial || input.durationMinutes !== undefined) {
    if (!Number.isInteger(input.durationMinutes)
      || input.durationMinutes < MIN_DURATION_MINUTES
      || input.durationMinutes > MAX_DURATION_MINUTES) {
      return invalid("invalid_duration", "La duración debe ser un entero entre 5 y 480 minutos.");
    }
    value.durationMinutes = input.durationMinutes;
  }

  if (!partial || input.priceCOP !== undefined) {
    if (!Number.isInteger(input.priceCOP)
      || input.priceCOP < SERVICE_PRICE_MIN_COP
      || input.priceCOP > SERVICE_PRICE_MAX_COP) {
      return invalid("invalid_price", "El precio debe ser un entero entre 0 y 10.000.000 COP.");
    }
    value.priceCOP = input.priceCOP;
  }

  return { ok: true, value };
}

export async function listServices({ tenantId, includeInactive = false, repository }) {
  const docs = await repository.list(tenantId);
  const services = docs
    .map((doc) => serializeService(doc.serviceId, doc.data))
    .filter((service) => includeInactive || service.active)
    .sort(compareServices);
  return { ok: true, services };
}

export async function createService({ tenantId, body, repository }) {
  const validation = validateServiceInput(body, { partial: false });
  if (!validation.ok) return validation;

  const services = await repository.list(tenantId);
  const nameKey = normalizeServiceName(validation.value.name);
  if (services.some((doc) => normalizeServiceName(doc.data?.name) === nameKey)) {
    return nameTaken();
  }

  const created = await repository.create(tenantId, { ...validation.value, active: true });
  return { ok: true, status: 201, service: serializeService(created.serviceId, created.data) };
}

export async function updateService({ tenantId, serviceId, body, repository }) {
  if (!isValidServiceId(serviceId)) return serviceNotFound();
  const current = await repository.get(tenantId, serviceId);
  if (!current) return serviceNotFound();

  const validation = validateServiceInput(body, { partial: true });
  if (!validation.ok) return validation;

  if (validation.value.name !== undefined) {
    const nameKey = normalizeServiceName(validation.value.name);
    const services = await repository.list(tenantId);
    const duplicated = services.some((doc) => doc.serviceId !== serviceId
      && normalizeServiceName(doc.data?.name) === nameKey);
    if (duplicated) return nameTaken();
  }

  if (Object.keys(validation.value).length === 0) {
    return { ok: true, service: serializeService(serviceId, current.data) };
  }

  const updated = await repository.update(tenantId, serviceId, validation.value);
  return { ok: true, service: serializeService(serviceId, updated.data) };
}

// Borrado lógico: el documento se conserva con active=false.
export async function deactivateService({ tenantId, serviceId, repository }) {
  if (!isValidServiceId(serviceId)) return serviceNotFound();
  const current = await repository.get(tenantId, serviceId);
  if (!current) return serviceNotFound();
  if (current.data?.active === false) {
    return { ok: true, service: serializeService(serviceId, current.data) };
  }

  const updated = await repository.update(tenantId, serviceId, { active: false });
  return { ok: true, service: serializeService(serviceId, updated.data) };
}

// Servicios activos para el agente/prompt (con filtro opcional por texto).
export async function listActiveServices({ tenantId, repository, query = null, limit = MAX_ACTIVE_SERVICES_FOR_AGENT }) {
  const result = await listServices({ tenantId, repository, includeInactive: false });
  const needle = typeof query === "string" ? normalizeServiceName(query) : "";
  const services = needle === ""
    ? result.services
    : result.services.filter((service) => normalizeServiceName(service.name).includes(needle)
      || normalizeServiceName(service.category).includes(needle));
  return { ok: true, services: services.slice(0, limit) };
}

export async function getActiveService({ tenantId, serviceId, repository }) {
  if (!isValidServiceId(serviceId)) return null;
  const current = await repository.get(tenantId, serviceId);
  if (!current || current.data?.active === false) return null;
  return serializeService(serviceId, current.data);
}

export function serializeService(serviceId, data) {
  return {
    serviceId,
    id: serviceId,
    name: typeof data?.name === "string" ? data.name : "",
    description: typeof data?.description === "string" ? data.description : "",
    category: typeof data?.category === "string" ? data.category : "",
    durationMinutes: Number.isInteger(data?.durationMinutes) ? data.durationMinutes : 0,
    priceCOP: Number.isInteger(data?.priceCOP) ? data.priceCOP : 0,
    active: data?.active !== false,
    createdAt: toIsoString(data?.createdAt),
    updatedAt: toIsoString(data?.updatedAt),
  };
}

function compareServices(a, b) {
  const aTime = toMillis(a.createdAt);
  const bTime = toMillis(b.createdAt);
  if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
  return a.name.localeCompare(b.name, "es");
}

function toIsoString(value) {
  const millis = toMillis(value);
  return millis === null ? null : new Date(millis).toISOString();
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function nameTaken() {
  return {
    ok: false,
    status: 409,
    code: "service_name_taken",
    message: "Ya existe un servicio con ese nombre en el negocio.",
  };
}

function serviceNotFound() {
  return {
    ok: false,
    status: 404,
    code: "service_not_found",
    message: "No encontramos ese servicio en el negocio.",
  };
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

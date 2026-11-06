// Profesionales del negocio: validación pura y CRUD con repositorio inyectable.
// La comisión se guarda anidada tal como el contrato (type/percent/amountCOP/
// rentCOP/effectiveFrom).

import { isValidLocalDate } from "./timezone.js";

export const PROFESSIONAL_NAME_MIN_LENGTH = 2;
export const PROFESSIONAL_NAME_MAX_LENGTH = 80;
export const PROFESSIONAL_PHONE_MIN_DIGITS = 7;
export const PROFESSIONAL_PHONE_MAX_DIGITS = 15;
export const PROFESSIONAL_EMAIL_MAX_LENGTH = 120;
export const PROFESSIONAL_NOTES_MAX_LENGTH = 200;
export const COMMISSION_TYPES = Object.freeze(["percentage", "fixed", "rent", "mixed"]);
export const MAX_COMMISSION_PERCENT = 100;
export const MAX_COMMISSION_AMOUNT_COP = 10_000_000;

const PROFESSIONAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidProfessionalId(professionalId) {
  return typeof professionalId === "string" && PROFESSIONAL_ID_PATTERN.test(professionalId);
}

export function normalizeProfessionalName(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProfessionalPhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < PROFESSIONAL_PHONE_MIN_DIGITS || digits.length > PROFESSIONAL_PHONE_MAX_DIGITS) return null;
  return digits;
}

// partial=true para PATCH: valida solo los campos enviados.
export function validateProfessionalInput(body, { partial = false, defaultEffectiveFrom = null } = {}) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const value = {};

  if (!partial || input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length < PROFESSIONAL_NAME_MIN_LENGTH || name.length > PROFESSIONAL_NAME_MAX_LENGTH) {
      return invalid("invalid_professional_name", "El nombre del profesional debe tener entre 2 y 80 caracteres.");
    }
    value.name = name;
  }

  if (input.phone !== undefined) {
    if (input.phone === null) {
      value.phone = "";
    } else if (typeof input.phone !== "string") {
      return invalid("invalid_professional_phone", "El teléfono debe ser texto con entre 7 y 15 dígitos.");
    } else {
      const raw = input.phone.trim();
      if (raw === "") {
        value.phone = "";
      } else {
        const digits = normalizeProfessionalPhone(raw);
        if (!digits) {
          return invalid("invalid_professional_phone", "El teléfono debe tener entre 7 y 15 dígitos.");
        }
        value.phone = digits;
      }
    }
  } else if (!partial) {
    value.phone = "";
  }

  if (input.email !== undefined) {
    if (typeof input.email !== "string") {
      return invalid("invalid_professional_email", "El correo debe ser texto.");
    }
    const email = input.email.trim();
    if (email.length > PROFESSIONAL_EMAIL_MAX_LENGTH) {
      return invalid("invalid_professional_email", "El correo no puede superar 120 caracteres.");
    }
    if (email !== "" && !EMAIL_PATTERN.test(email)) {
      return invalid("invalid_professional_email", "El correo no tiene un formato válido.");
    }
    value.email = email;
  } else if (!partial) {
    value.email = "";
  }

  if (input.notes !== undefined) {
    if (typeof input.notes !== "string") {
      return invalid("invalid_professional_notes", "Las notas deben ser texto.");
    }
    const notes = input.notes.trim();
    if (notes.length > PROFESSIONAL_NOTES_MAX_LENGTH) {
      return invalid("invalid_professional_notes", "Las notas no pueden superar 200 caracteres.");
    }
    value.notes = notes;
  } else if (!partial) {
    value.notes = "";
  }

  if (input.commission !== undefined && input.commission !== null) {
    const commission = validateCommission(input.commission, defaultEffectiveFrom);
    if (!commission.ok) return commission;
    value.commission = commission.value;
  } else if (!partial) {
    value.commission = buildDefaultCommission(defaultEffectiveFrom);
  }

  return { ok: true, value };
}

export function validateCommission(raw, defaultEffectiveFrom = null) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return invalid("invalid_commission_type", "La comisión debe ser un objeto con un tipo válido.");
  }

  const type = raw.type;
  if (!COMMISSION_TYPES.includes(type)) {
    return invalid("invalid_commission_type", "El tipo de comisión debe ser percentage, fixed, rent o mixed.");
  }

  const percent = raw.percent;
  if (type === "percentage" || type === "mixed") {
    if (!Number.isInteger(percent) || percent < 0 || percent > MAX_COMMISSION_PERCENT) {
      return invalid("invalid_percent", "El porcentaje debe ser un entero entre 0 y 100.");
    }
  } else if (percent !== undefined && (!Number.isInteger(percent) || percent < 0 || percent > MAX_COMMISSION_PERCENT)) {
    return invalid("invalid_percent", "El porcentaje debe ser un entero entre 0 y 100.");
  }

  const amountCOP = raw.amountCOP;
  if (type === "fixed") {
    if (!Number.isInteger(amountCOP) || amountCOP < 0 || amountCOP > MAX_COMMISSION_AMOUNT_COP) {
      return invalid("invalid_amount", "El monto fijo debe ser un entero entre 0 y 10.000.000 COP.");
    }
  } else if (amountCOP !== undefined && (!Number.isInteger(amountCOP) || amountCOP < 0 || amountCOP > MAX_COMMISSION_AMOUNT_COP)) {
    return invalid("invalid_amount", "El monto fijo debe ser un entero entre 0 y 10.000.000 COP.");
  }

  const rentCOP = raw.rentCOP;
  if (type === "rent" || type === "mixed") {
    if (!Number.isInteger(rentCOP) || rentCOP < 0 || rentCOP > MAX_COMMISSION_AMOUNT_COP) {
      return invalid("invalid_rent", "El alquiler debe ser un entero entre 0 y 10.000.000 COP.");
    }
  } else if (rentCOP !== undefined && (!Number.isInteger(rentCOP) || rentCOP < 0 || rentCOP > MAX_COMMISSION_AMOUNT_COP)) {
    return invalid("invalid_rent", "El alquiler debe ser un entero entre 0 y 10.000.000 COP.");
  }

  const effectiveFrom = raw.effectiveFrom === undefined || raw.effectiveFrom === null || raw.effectiveFrom === ""
    ? defaultEffectiveFrom
    : raw.effectiveFrom;
  if (typeof effectiveFrom !== "string" || !isValidLocalDate(effectiveFrom)) {
    return invalid("invalid_effective_from", "La vigencia debe ser una fecha AAAA-MM-DD válida.");
  }

  return {
    ok: true,
    value: {
      type,
      percent: type === "percentage" || type === "mixed" ? percent : (percent ?? 0),
      amountCOP: type === "fixed" ? amountCOP : (amountCOP ?? 0),
      rentCOP: type === "rent" || type === "mixed" ? rentCOP : (rentCOP ?? 0),
      effectiveFrom,
    },
  };
}

export async function listProfessionals({ tenantId, includeInactive = false, repository }) {
  const docs = await repository.list(tenantId);
  const professionals = docs
    .map((doc) => serializeProfessional(doc.professionalId, doc.data))
    .filter((professional) => includeInactive || professional.active)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { ok: true, professionals, total: professionals.length };
}

export async function getProfessional({ tenantId, professionalId, repository }) {
  if (!isValidProfessionalId(professionalId)) return null;
  const current = await repository.get(tenantId, professionalId);
  return current ? serializeProfessional(professionalId, current.data) : null;
}

export async function createProfessional({ tenantId, body, defaultEffectiveFrom = null, repository }) {
  const validation = validateProfessionalInput(body, { partial: false, defaultEffectiveFrom });
  if (!validation.ok) return validation;

  if (await nameExists({ tenantId, name: validation.value.name, repository })) {
    return nameTaken();
  }

  const created = await repository.create(tenantId, { ...validation.value, active: true });
  return { ok: true, status: 201, professional: serializeProfessional(created.professionalId, created.data) };
}

export async function updateProfessional({ tenantId, professionalId, body, defaultEffectiveFrom = null, repository }) {
  if (!isValidProfessionalId(professionalId)) return professionalNotFound();
  const current = await repository.get(tenantId, professionalId);
  if (!current) return professionalNotFound();

  const validation = validateProfessionalInput(body, { partial: true, defaultEffectiveFrom });
  if (!validation.ok) return validation;

  if (validation.value.name !== undefined
    && await nameExists({ tenantId, name: validation.value.name, excludeProfessionalId: professionalId, repository })) {
    return nameTaken();
  }

  if (Object.keys(validation.value).length === 0) {
    return { ok: true, professional: serializeProfessional(professionalId, current.data) };
  }

  const updated = await repository.update(tenantId, professionalId, validation.value);
  return { ok: true, professional: serializeProfessional(professionalId, updated.data) };
}

export async function deactivateProfessional({ tenantId, professionalId, repository }) {
  if (!isValidProfessionalId(professionalId)) return professionalNotFound();
  const current = await repository.get(tenantId, professionalId);
  if (!current) return professionalNotFound();
  if (current.data?.active === false) {
    return { ok: true, professional: serializeProfessional(professionalId, current.data) };
  }

  const updated = await repository.update(tenantId, professionalId, { active: false });
  return { ok: true, professional: serializeProfessional(professionalId, updated.data) };
}

export function serializeProfessional(professionalId, data) {
  return {
    professionalId,
    id: professionalId,
    name: typeof data?.name === "string" ? data.name : "",
    phone: typeof data?.phone === "string" ? data.phone : "",
    email: typeof data?.email === "string" ? data.email : "",
    notes: typeof data?.notes === "string" ? data.notes : "",
    active: data?.active !== false,
    commission: serializeCommission(data?.commission),
    createdAt: toIsoString(data?.createdAt),
    updatedAt: toIsoString(data?.updatedAt),
  };
}

export function serializeCommission(commission) {
  const data = commission && typeof commission === "object" ? commission : {};
  return {
    type: COMMISSION_TYPES.includes(data.type) ? data.type : "percentage",
    percent: Number.isInteger(data.percent) ? data.percent : 0,
    amountCOP: Number.isInteger(data.amountCOP) ? data.amountCOP : 0,
    rentCOP: Number.isInteger(data.rentCOP) ? data.rentCOP : 0,
    effectiveFrom: typeof data.effectiveFrom === "string" ? data.effectiveFrom : null,
  };
}

function buildDefaultCommission(defaultEffectiveFrom) {
  return {
    type: "percentage",
    percent: 0,
    amountCOP: 0,
    rentCOP: 0,
    effectiveFrom: typeof defaultEffectiveFrom === "string" ? defaultEffectiveFrom : null,
  };
}

async function nameExists({ tenantId, name, excludeProfessionalId = null, repository }) {
  const docs = await repository.list(tenantId);
  const key = normalizeProfessionalName(name);
  return docs.some((doc) => doc.professionalId !== excludeProfessionalId
    && normalizeProfessionalName(doc.data?.name) === key);
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
    code: "professional_name_taken",
    message: "Ya existe un profesional con ese nombre en el negocio.",
  };
}

function professionalNotFound() {
  return {
    ok: false,
    status: 404,
    code: "professional_not_found",
    message: "No encontramos ese profesional en el negocio.",
  };
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

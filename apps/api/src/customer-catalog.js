// Clientes: validación pura y operaciones CRUD. No importa Firestore: recibe un
// repositorio (customer-repository.js en producción, un doble en pruebas).

export const CUSTOMER_NAME_MIN_LENGTH = 2;
export const CUSTOMER_NAME_MAX_LENGTH = 80;
export const CUSTOMER_PHONE_MIN_DIGITS = 7;
export const CUSTOMER_PHONE_MAX_DIGITS = 15;
export const CUSTOMER_EMAIL_MAX_LENGTH = 120;
export const CUSTOMER_NOTES_MAX_LENGTH = 300;
export const CUSTOMER_QUERY_MAX_LENGTH = 40;
export const MAX_AGENT_CUSTOMERS = 10;

const CUSTOMER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidCustomerId(customerId) {
  return typeof customerId === "string" && CUSTOMER_ID_PATTERN.test(customerId);
}

// Teléfono normalizado: solo dígitos, 7-15. Devuelve null si no es válido.
export function normalizeCustomerPhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < CUSTOMER_PHONE_MIN_DIGITS || digits.length > CUSTOMER_PHONE_MAX_DIGITS) return null;
  return digits;
}

// Texto sin tildes, minúsculas y espacios colapsados (para búsquedas).
export function normalizeCustomerText(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function digitsOnly(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "");
}

// partial=true para PATCH: valida solo los campos enviados (objeto vacío = no-op).
export function validateCustomerInput(body, { partial = false } = {}) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const value = {};

  if (!partial || input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length < CUSTOMER_NAME_MIN_LENGTH || name.length > CUSTOMER_NAME_MAX_LENGTH) {
      return invalid("invalid_customer_name", "El nombre del cliente debe tener entre 2 y 80 caracteres.");
    }
    value.name = name;
  }

  if (input.phone !== undefined) {
    if (input.phone === null) {
      value.phone = "";
    } else {
      if (typeof input.phone !== "string") {
        return invalid("invalid_customer_phone", "El teléfono debe ser texto con entre 7 y 15 dígitos.");
      }
      const raw = input.phone.trim();
      if (raw === "") {
        value.phone = "";
      } else {
        const digits = raw.replace(/\D/g, "");
        if (digits.length < CUSTOMER_PHONE_MIN_DIGITS || digits.length > CUSTOMER_PHONE_MAX_DIGITS) {
          return invalid("invalid_customer_phone", "El teléfono debe tener entre 7 y 15 dígitos.");
        }
        value.phone = digits;
      }
    }
  } else if (!partial) {
    value.phone = "";
  }

  if (input.email !== undefined) {
    if (typeof input.email !== "string") {
      return invalid("invalid_customer_email", "El correo debe ser texto.");
    }
    const email = input.email.trim();
    if (email.length > CUSTOMER_EMAIL_MAX_LENGTH) {
      return invalid("invalid_customer_email", "El correo no puede superar 120 caracteres.");
    }
    if (email !== "" && !EMAIL_PATTERN.test(email)) {
      return invalid("invalid_customer_email", "El correo no tiene un formato válido.");
    }
    value.email = email;
  } else if (!partial) {
    value.email = "";
  }

  if (input.notes !== undefined) {
    if (typeof input.notes !== "string") {
      return invalid("invalid_customer_notes", "Las notas deben ser texto.");
    }
    const notes = input.notes.trim();
    if (notes.length > CUSTOMER_NOTES_MAX_LENGTH) {
      return invalid("invalid_customer_notes", "Las notas no pueden superar 300 caracteres.");
    }
    value.notes = notes;
  } else if (!partial) {
    value.notes = "";
  }

  return { ok: true, value };
}

export async function listCustomers({ tenantId, query = null, includeInactive = false, repository }) {
  const docs = await repository.list(tenantId);
  const customers = docs
    .map((doc) => serializeCustomer(doc.customerId, doc.data))
    .filter((customer) => includeInactive || customer.active);

  const needle = normalizeCustomerText(query ?? "");
  const phoneNeedle = digitsOnly(query ?? "");
  const filtered = needle === "" && phoneNeedle === ""
    ? customers
    : customers.filter((customer) => {
      if (needle !== "" && normalizeCustomerText(customer.name).includes(needle)) return true;
      if (phoneNeedle !== "" && customer.phone.includes(phoneNeedle)) return true;
      return false;
    });

  filtered.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { ok: true, customers: filtered, total: filtered.length };
}

// Clientes activos para el agente (máx. 10, búsqueda por nombre o teléfono).
export async function searchActiveCustomers({ tenantId, query = "", limit = MAX_AGENT_CUSTOMERS, repository }) {
  const needle = normalizeCustomerText(query ?? "");
  const phoneNeedle = digitsOnly(query ?? "");
  if (needle === "" && phoneNeedle === "") return { ok: true, customers: [] };

  const docs = await repository.list(tenantId);
  const customers = docs
    .map((doc) => serializeCustomer(doc.customerId, doc.data))
    .filter((customer) => customer.active)
    .filter((customer) => (needle !== "" && normalizeCustomerText(customer.name).includes(needle))
      || (phoneNeedle !== "" && customer.phone.includes(phoneNeedle)))
    .slice(0, limit);
  return { ok: true, customers };
}

export async function getCustomer({ tenantId, customerId, repository }) {
  if (!isValidCustomerId(customerId)) return null;
  const current = await repository.get(tenantId, customerId);
  return current ? serializeCustomer(customerId, current.data) : null;
}

export async function findCustomerByPhone({ tenantId, phone, repository }) {
  const normalized = normalizeCustomerPhone(phone);
  if (!normalized) return null;
  const current = await repository.findByPhone(tenantId, normalized);
  return current ? serializeCustomer(current.customerId, current.data) : null;
}

export async function createCustomer({ tenantId, body, repository }) {
  const validation = validateCustomerInput(body, { partial: false });
  if (!validation.ok) return validation;

  if (validation.value.phone !== "" && await phoneExists({ tenantId, phone: validation.value.phone, repository })) {
    return phoneTaken();
  }

  const created = await repository.create(tenantId, { ...validation.value, active: true });
  return { ok: true, status: 201, customer: serializeCustomer(created.customerId, created.data) };
}

export async function updateCustomer({ tenantId, customerId, body, repository }) {
  if (!isValidCustomerId(customerId)) return customerNotFound();
  const current = await repository.get(tenantId, customerId);
  if (!current) return customerNotFound();

  const validation = validateCustomerInput(body, { partial: true });
  if (!validation.ok) return validation;

  if (validation.value.phone !== undefined
    && validation.value.phone !== ""
    && await phoneExists({ tenantId, phone: validation.value.phone, excludeCustomerId: customerId, repository })) {
    return phoneTaken();
  }

  if (Object.keys(validation.value).length === 0) {
    return { ok: true, customer: serializeCustomer(customerId, current.data) };
  }

  const updated = await repository.update(tenantId, customerId, validation.value);
  return { ok: true, customer: serializeCustomer(customerId, updated.data) };
}

// Borrado lógico: el documento se conserva con active=false.
export async function deactivateCustomer({ tenantId, customerId, repository }) {
  if (!isValidCustomerId(customerId)) return customerNotFound();
  const current = await repository.get(tenantId, customerId);
  if (!current) return customerNotFound();
  if (current.data?.active === false) {
    return { ok: true, customer: serializeCustomer(customerId, current.data) };
  }

  const updated = await repository.update(tenantId, customerId, { active: false });
  return { ok: true, customer: serializeCustomer(customerId, updated.data) };
}

export function serializeCustomer(customerId, data) {
  return {
    customerId,
    id: customerId,
    name: typeof data?.name === "string" ? data.name : "",
    phone: typeof data?.phone === "string" ? data.phone : "",
    email: typeof data?.email === "string" ? data.email : "",
    notes: typeof data?.notes === "string" ? data.notes : "",
    active: data?.active !== false,
    createdAt: toIsoString(data?.createdAt),
    updatedAt: toIsoString(data?.updatedAt),
  };
}

async function phoneExists({ tenantId, phone, excludeCustomerId = null, repository }) {
  const docs = await repository.list(tenantId);
  return docs.some((doc) => doc.customerId !== excludeCustomerId && doc.data?.phone === phone);
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

function phoneTaken() {
  return {
    ok: false,
    status: 409,
    code: "customer_phone_taken",
    message: "Ya existe un cliente con ese teléfono en el negocio.",
  };
}

function customerNotFound() {
  return {
    ok: false,
    status: 404,
    code: "customer_not_found",
    message: "No encontramos ese cliente en el negocio.",
  };
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

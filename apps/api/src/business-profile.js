// Perfil del negocio: descripción, dirección, teléfono y redes sociales.
// Lógica pura (sin Express ni Firestore) reutilizada por PATCH y por las
// respuestas de /context y /me/tenants.

export const DESCRIPTION_MAX_LENGTH = 300;
export const ADDRESS_MAX_LENGTH = 200;
export const PHONE_MAX_LENGTH = 30;
export const SOCIAL_LINK_MAX_LENGTH = 120;

export const SOCIAL_LINK_KEYS = Object.freeze(["instagram", "facebook", "tiktok", "whatsapp", "website"]);
const URL_SOCIAL_KEYS = new Set(["instagram", "facebook", "tiktok", "website"]);
const PHONE_PATTERN = /^[0-9+\-()\s]*$/;
const HTTPS_URL_PATTERN = /^https:\/\/\S+$/i;
const WHATSAPP_CHARS_PATTERN = /^[0-9+\-()\s]+$/;

// Valida solo los campos de perfil presentes en el body (PATCH parcial).
// No devuelve "empty_update": la ruta combina esto con el horario.
export function validateBusinessProfileInput(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const value = {};
  let hasAny = false;

  if (input.description !== undefined) {
    hasAny = true;
    if (typeof input.description !== "string") {
      return invalid("invalid_description", "La descripción debe ser texto.");
    }
    const description = input.description.trim();
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      return invalid("invalid_description", "La descripción no puede superar 300 caracteres.");
    }
    value.description = description;
  }

  if (input.address !== undefined) {
    hasAny = true;
    if (typeof input.address !== "string") {
      return invalid("invalid_address", "La dirección debe ser texto.");
    }
    const address = input.address.trim();
    if (address.length > ADDRESS_MAX_LENGTH) {
      return invalid("invalid_address", "La dirección no puede superar 200 caracteres.");
    }
    value.address = address;
  }

  if (input.phone !== undefined) {
    hasAny = true;
    if (typeof input.phone !== "string") {
      return invalid("invalid_phone", "El teléfono debe ser texto.");
    }
    const phone = input.phone.trim();
    if (phone.length > PHONE_MAX_LENGTH || !PHONE_PATTERN.test(phone)) {
      return invalid("invalid_phone", "El teléfono admite dígitos, espacios, +, - y paréntesis (máximo 30 caracteres).");
    }
    value.phone = phone;
  }

  if (input.socialLinks !== undefined) {
    hasAny = true;
    const links = input.socialLinks;
    if (!links || typeof links !== "object" || Array.isArray(links)) {
      return invalid("invalid_social_link", "Las redes sociales deben ser un objeto con instagram, facebook, tiktok, whatsapp y website.");
    }
    for (const key of Object.keys(links)) {
      if (!SOCIAL_LINK_KEYS.includes(key)) {
        return invalid("invalid_social_link", "Las redes solo admiten instagram, facebook, tiktok, whatsapp y website.");
      }
    }
    const normalized = {};
    for (const key of SOCIAL_LINK_KEYS) {
      if (links[key] === undefined) continue;
      const result = normalizeSocialLink(key, links[key]);
      if (!result.ok) return result;
      normalized[key] = result.value;
    }
    value.socialLinks = normalized;
  }

  return { ok: true, value, hasAny };
}

function normalizeSocialLink(key, raw) {
  if (raw === null) return { ok: true, value: "" };
  if (typeof raw !== "string") return invalidSocialLink();
  const value = raw.trim();
  if (value.length > SOCIAL_LINK_MAX_LENGTH) {
    return invalid("invalid_social_link", "Cada red no puede superar 120 caracteres.");
  }
  if (value === "") return { ok: true, value: "" };

  if (URL_SOCIAL_KEYS.has(key)) {
    if (!HTTPS_URL_PATTERN.test(value)) {
      return invalid("invalid_social_link", `${key} debe empezar por https:// o quedar vacío.`);
    }
    return { ok: true, value };
  }

  // whatsapp: número con 7–15 dígitos (se guarda normalizado) o vacío.
  if (!WHATSAPP_CHARS_PATTERN.test(value)) {
    return invalid("invalid_social_link", "whatsapp debe ser un número de 7 a 15 dígitos o quedar vacío.");
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return invalid("invalid_social_link", "whatsapp debe tener entre 7 y 15 dígitos.");
  }
  return { ok: true, value: digits };
}

// Perfil efectivo de un tenant (defaults vacíos para tenants antiguos).
export function resolveBusinessProfile(tenant) {
  const socialLinks = tenant?.socialLinks && typeof tenant.socialLinks === "object" ? tenant.socialLinks : {};
  const resolvedLinks = {};
  for (const key of SOCIAL_LINK_KEYS) {
    resolvedLinks[key] = typeof socialLinks[key] === "string" ? socialLinks[key] : "";
  }
  return {
    description: typeof tenant?.description === "string" ? tenant.description : "",
    address: typeof tenant?.address === "string" ? tenant.address : "",
    phone: typeof tenant?.phone === "string" ? tenant.phone : "",
    socialLinks: resolvedLinks,
  };
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

function invalidSocialLink() {
  return invalid("invalid_social_link", "Cada red debe ser texto válido (https:// en redes o número en whatsapp).");
}

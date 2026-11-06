// Invitaciones de trabajadores: token aleatorio (solo se guarda su sha256),
// vencimiento y serializaciones seguras. Lógica pura y comprobable.

import { createHash, randomBytes } from "node:crypto";

export const DEFAULT_INVITATION_DAYS = 7;
export const MAX_INVITATION_DAYS = 365;
export const DEFAULT_PUBLIC_APP_URL = "http://localhost:5173";
export const INVITATION_ROLE = "professional";
export const INVITATION_STATUSES = Object.freeze(["pending", "accepted", "cancelled", "expired"]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 120;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

export function resolveInvitationDays(env = process.env) {
  const value = Number(env?.INVITATION_DAYS);
  return Number.isInteger(value) && value > 0 && value <= MAX_INVITATION_DAYS ? value : DEFAULT_INVITATION_DAYS;
}

export function generateInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function buildInvitationLink(token, env = process.env) {
  const rawBase = typeof env?.PUBLIC_APP_URL === "string" && env.PUBLIC_APP_URL.trim() !== ""
    ? env.PUBLIC_APP_URL.trim()
    : DEFAULT_PUBLIC_APP_URL;
  const base = rawBase.replace(/\/+$/, "");
  return `${base}/invite/${token}`;
}

// Al menos uno de email/phone es obligatorio. professionalId es obligatorio en el
// cuerpo (la ruta comprueba que exista en el negocio).
export function validateInvitationInput(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const professionalId = typeof input.professionalId === "string" ? input.professionalId.trim() : "";
  if (professionalId === "") {
    return invalidInvitee("Indica el profesional a invitar.");
  }

  let email = "";
  if (input.email !== undefined && input.email !== null) {
    if (typeof input.email !== "string") return invalidInvitee("El correo no es válido.");
    email = input.email.trim();
    if (email !== "" && (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email))) {
      return invalidInvitee("El correo no es válido.");
    }
  }

  let phone = "";
  if (input.phone !== undefined && input.phone !== null) {
    if (typeof input.phone !== "string") return invalidInvitee("El teléfono no es válido.");
    const digits = input.phone.replace(/\D/g, "");
    if (digits !== "") {
      if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
        return invalidInvitee("El teléfono debe tener entre 7 y 15 dígitos.");
      }
      phone = digits;
    }
  }

  if (email === "" && phone === "") {
    return invalidInvitee("Indica al menos un correo o un teléfono.");
  }

  return { ok: true, value: { professionalId, email, phone } };
}

export function computeInvitationStatus(invitation, now = new Date()) {
  const stored = invitation?.status;
  if (stored === "accepted" || stored === "cancelled" || stored === "expired") return stored;
  const expiresAtMs = toMillis(invitation?.expiresAt);
  if (expiresAtMs !== null && expiresAtMs <= now.getTime()) return "expired";
  return "pending";
}

// Listado/administración: nunca incluye token ni tokenHash.
export function serializeInvitation(invitationId, data, now = new Date()) {
  return {
    id: invitationId,
    professionalId: typeof data?.professionalId === "string" ? data.professionalId : null,
    professionalName: typeof data?.professionalName === "string" ? data.professionalName : "",
    email: typeof data?.email === "string" ? data.email : "",
    phone: typeof data?.phone === "string" ? data.phone : "",
    role: INVITATION_ROLE,
    status: computeInvitationStatus(data, now),
    expiresAt: toIsoString(data?.expiresAt),
    createdAt: toIsoString(data?.createdAt),
    acceptedBy: typeof data?.acceptedBy === "string" ? data.acceptedBy : null,
    acceptedAt: toIsoString(data?.acceptedAt),
  };
}

// Vista pública de la pantalla /invite/<token>.
export function buildPublicInvitation({ tenant, professionalName, invitation, now = new Date() }) {
  const status = computeInvitationStatus(invitation, now);
  return {
    tenant: {
      name: typeof tenant?.name === "string" ? tenant.name : "",
      slug: typeof tenant?.slug === "string" ? tenant.slug : "",
    },
    professional: {
      name: typeof professionalName === "string" ? professionalName : "",
    },
    email: typeof invitation?.email === "string" ? invitation.email : "",
    expiresAt: toIsoString(invitation?.expiresAt),
    valid: status === "pending",
    status,
  };
}

function invalidInvitee(message) {
  return { ok: false, status: 400, code: "invalid_invitee", message };
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

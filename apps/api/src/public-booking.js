// Lógica pura de la página pública de reservas: validación de slug, ventana de
// fechas, duración del servicio, horario/futuro de la cita y saneado de datos
// públicos (nunca exponer correo del dueño, comisiones, teléfonos, clientes…).

import { businessDayNumber } from "./availability.js";
import {
  addDays,
  formatLocalDateTime,
  isValidLocalDate,
  isValidTimeZone,
  localToUtc,
  parseLocalDateTime,
  utcToLocalDate,
} from "./timezone.js";

export const PUBLIC_AVAILABILITY_DAYS = 60;
export const PUBLIC_DEFAULT_DURATION_MINUTES = 30;
export const PUBLIC_SOCIAL_KEYS = Object.freeze(["instagram", "facebook", "tiktok", "whatsapp", "website"]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FALLBACK_TIME_ZONE = "America/Bogota";

export function isValidPublicSlug(slug) {
  return typeof slug === "string" && slug.length >= 1 && slug.length <= 50 && SLUG_PATTERN.test(slug);
}

// date obligatoria, un solo día, entre hoy y los próximos 60 días (zona del negocio).
export function resolvePublicAvailabilityDate({ date, now = new Date(), timeZone } = {}) {
  if (typeof date !== "string" || !isValidLocalDate(date.trim())) {
    return invalid("invalid_date", "Indica una fecha válida con formato AAAA-MM-DD.");
  }
  const resolvedDate = date.trim();
  const tz = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  const today = utcToLocalDate(now, tz);
  const lastDate = addDays(today, PUBLIC_AVAILABILITY_DAYS);
  if (resolvedDate < today || resolvedDate > lastDate) {
    return invalid("invalid_date", `La fecha debe estar entre hoy y los próximos ${PUBLIC_AVAILABILITY_DAYS} días.`);
  }
  return { ok: true, value: { date: resolvedDate, timeZone: tz } };
}

export function resolvePublicDuration(service, fallback = PUBLIC_DEFAULT_DURATION_MINUTES) {
  const duration = service?.durationMinutes;
  return Number.isInteger(duration) && duration >= 5 && duration <= 480 ? duration : fallback;
}

export function validatePublicBookingInput(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const customerName = typeof input.customerName === "string" ? input.customerName.trim() : "";
  if (customerName.length < 2 || customerName.length > 80) {
    return invalid("invalid_name", "El nombre debe tener entre 2 y 80 caracteres.");
  }

  const rawPhone = typeof input.customerPhone === "string" ? input.customerPhone : "";
  const customerPhone = rawPhone.replace(/\D/g, "");
  if (customerPhone.length < 7 || customerPhone.length > 15) {
    return invalid("invalid_customer_phone", "El teléfono debe tener entre 7 y 15 dígitos.");
  }

  const serviceId = typeof input.serviceId === "string" ? input.serviceId.trim() : "";
  if (serviceId === "") {
    return { ok: false, status: 404, code: "service_not_found", message: "No encontramos ese servicio en el negocio." };
  }

  const professionalId = typeof input.professionalId === "string" && input.professionalId.trim() !== ""
    ? input.professionalId.trim()
    : null;

  const startsAtParts = parseLocalDateTime(input.startsAt);
  if (!startsAtParts) {
    return invalid("invalid_start", "La hora debe venir como AAAA-MM-DDTHH:mm.");
  }

  const clientRequestId = typeof input.clientRequestId === "string" && input.clientRequestId.trim() !== ""
    ? input.clientRequestId.trim()
    : null;

  return {
    ok: true,
    value: {
      customerName,
      customerPhone,
      serviceId,
      professionalId,
      startsAtLocal: formatLocalDateTime(startsAtParts),
      clientRequestId,
    },
  };
}

// La cita debe caer dentro del horario de atención del día y en el futuro.
export function validatePublicStart({ startsAtLocal, durationMinutes, openingHours, timeZone, now = new Date() }) {
  const parts = parseLocalDateTime(startsAtLocal);
  if (!parts) return outsideBusinessHours();

  const startMinutes = parts.hour * 60 + parts.minute;
  const dayNumber = businessDayNumber(
    `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
  );
  const dayWindows = (Array.isArray(openingHours) ? openingHours : []).filter((entry) => entry.day === dayNumber);
  const fits = dayWindows.some((entry) => {
    const open = parseTimeToMinutes(entry.open);
    const close = parseTimeToMinutes(entry.close);
    if (open === null || close === null) return false;
    return startMinutes >= open && startMinutes + durationMinutes <= close;
  });
  if (!fits) return outsideBusinessHours();

  const tz = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  const startsAtUtc = localToUtc(startsAtLocal, tz);
  if (startsAtUtc.getTime() <= now.getTime()) return outsideBusinessHours();

  return { ok: true, value: { startsAtLocal, startsAtUtc } };
}

// --- Saneado de datos públicos -------------------------------------------
export function sanitizePublicTenant(tenant) {
  const socialLinks = tenant?.socialLinks && typeof tenant.socialLinks === "object" ? tenant.socialLinks : {};
  return {
    name: typeof tenant?.name === "string" ? tenant.name : "",
    slug: typeof tenant?.slug === "string" ? tenant.slug : "",
    sector: typeof tenant?.sector === "string" ? tenant.sector : "",
    description: typeof tenant?.description === "string" ? tenant.description : "",
    address: typeof tenant?.address === "string" ? tenant.address : "",
    phone: typeof tenant?.phone === "string" ? tenant.phone : "",
    socialLinks: Object.fromEntries(PUBLIC_SOCIAL_KEYS.map((key) => [
      key,
      typeof socialLinks[key] === "string" ? socialLinks[key] : "",
    ])),
    timeZone: isValidTimeZone(tenant?.timeZone) ? tenant.timeZone : FALLBACK_TIME_ZONE,
  };
}

export function sanitizePublicService(service) {
  return {
    serviceId: typeof service?.serviceId === "string" ? service.serviceId : service?.id ?? null,
    name: typeof service?.name === "string" ? service.name : "",
    description: typeof service?.description === "string" ? service.description : "",
    category: typeof service?.category === "string" ? service.category : "",
    durationMinutes: Number.isInteger(service?.durationMinutes) ? service.durationMinutes : 0,
    priceCOP: Number.isInteger(service?.priceCOP) ? service.priceCOP : 0,
  };
}

export function sanitizePublicProfessional(professional) {
  return {
    professionalId: typeof professional?.professionalId === "string" ? professional.professionalId : professional?.id ?? null,
    name: typeof professional?.name === "string" ? professional.name : "",
  };
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function outsideBusinessHours() {
  return {
    ok: false,
    status: 400,
    code: "outside_business_hours",
    message: "La hora no está disponible dentro del horario de atención.",
  };
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

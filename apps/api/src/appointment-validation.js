// Validaciones puras de la agenda. No tocan Express ni Firestore: reciben el
// cuerpo ya parseado y la zona horaria del negocio, y devuelven los códigos de
// error del contrato (docs/corte-agenda-panel-real.md).

import { createHash } from "node:crypto";
import {
  formatLocalDateTime,
  isValidLocalDate,
  localDateRangeToUtc,
  localToUtc,
  parseLocalDateTime,
} from "./timezone.js";

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;
const DURATION_MIN_MINUTES = 5;
const DURATION_MAX_MINUTES = 480;
const PRICE_MIN_COP = 0;
const PRICE_MAX_COP = 10_000_000;

export function validateAppointmentInput(body, timeZone) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const customerName = typeof input.customerName === "string" ? input.customerName.trim() : "";
  if (customerName.length < NAME_MIN_LENGTH || customerName.length > NAME_MAX_LENGTH) {
    return invalid("invalid_name", "El nombre del cliente debe tener entre 2 y 80 caracteres.");
  }

  const serviceName = typeof input.serviceName === "string" ? input.serviceName.trim() : "";
  if (serviceName.length < NAME_MIN_LENGTH || serviceName.length > NAME_MAX_LENGTH) {
    return invalid("invalid_service", "El servicio debe tener entre 2 y 80 caracteres.");
  }

  const startsAtParts = parseLocalDateTime(input.startsAt);
  if (!startsAtParts) {
    return invalid("invalid_start", "La hora de inicio debe venir como hora local del negocio (AAAA-MM-DDTHH:mm).");
  }
  const startsAtLocal = formatLocalDateTime(startsAtParts);
  let startsAtUtc;
  try {
    startsAtUtc = localToUtc(startsAtLocal, timeZone);
  } catch {
    return invalid("invalid_start", "La hora de inicio no es válida para la zona horaria del negocio.");
  }

  const durationMinutes = input.durationMinutes;
  if (!Number.isInteger(durationMinutes) || durationMinutes < DURATION_MIN_MINUTES || durationMinutes > DURATION_MAX_MINUTES) {
    return invalid("invalid_duration", "La duración debe ser un entero entre 5 y 480 minutos.");
  }

  const priceCOP = input.priceCOP;
  if (!Number.isInteger(priceCOP) || priceCOP < PRICE_MIN_COP || priceCOP > PRICE_MAX_COP) {
    return invalid("invalid_price", "El precio debe ser un entero entre 0 y 10.000.000 COP.");
  }

  const endsAtUtc = new Date(startsAtUtc.getTime() + durationMinutes * 60 * 1000);
  const customerPhone = typeof input.customerPhone === "string" && input.customerPhone.trim() !== ""
    ? input.customerPhone.trim()
    : null;
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const clientRequestId = typeof input.clientRequestId === "string" && input.clientRequestId.trim() !== ""
    ? input.clientRequestId.trim()
    : null;

  return {
    ok: true,
    value: {
      customerName,
      customerPhone,
      serviceName,
      startsAtLocal,
      startsAtUtc,
      endsAtUtc,
      durationMinutes,
      priceCOP,
      notes,
      clientRequestId,
    },
  };
}

export function validateAppointmentRange(query, timeZone) {
  const from = typeof query?.from === "string" ? query.from.trim() : "";
  const to = typeof query?.to === "string" ? query.to.trim() : "";
  if (!isValidLocalDate(from) || !isValidLocalDate(to) || from > to) {
    return invalid("invalid_range", "Indica un rango de fechas válido (from y to con formato AAAA-MM-DD).");
  }
  const { start, end } = localDateRangeToUtc(from, to, timeZone);
  return { ok: true, value: { from, to, start, end } };
}

// Reprogramación: `startsAt` es obligatorio (hora local del negocio);
// `durationMinutes` es opcional y, si falta, la ruta conserva la duración actual.
export function validateRescheduleInput(body, timeZone) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const startsAtParts = parseLocalDateTime(input.startsAt);
  if (!startsAtParts) {
    return invalid("invalid_start", "La nueva hora debe venir como hora local del negocio (AAAA-MM-DDTHH:mm).");
  }
  const startsAtLocal = formatLocalDateTime(startsAtParts);
  let startsAtUtc;
  try {
    startsAtUtc = localToUtc(startsAtLocal, timeZone);
  } catch {
    return invalid("invalid_start", "La nueva hora no es válida para la zona horaria del negocio.");
  }

  let durationMinutes = null;
  if (input.durationMinutes !== undefined) {
    if (!Number.isInteger(input.durationMinutes)
      || input.durationMinutes < DURATION_MIN_MINUTES
      || input.durationMinutes > DURATION_MAX_MINUTES) {
      return invalid("invalid_duration", "La duración debe ser un entero entre 5 y 480 minutos.");
    }
    durationMinutes = input.durationMinutes;
  }

  return { ok: true, value: { startsAtLocal, startsAtUtc, durationMinutes } };
}


// ID determinista por negocio a partir de clientRequestId: la idempotencia no
// necesita índice extra ni permite duplicados aunque lleguen dos peticiones a la vez.
export function deriveAppointmentId(clientRequestId) {
  const digest = createHash("sha256").update(String(clientRequestId)).digest("hex");
  return `appt_${digest.slice(0, 24)}`;
}

function invalid(code, message) {
  return { ok: false, code, message };
}

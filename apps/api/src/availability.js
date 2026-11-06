// Disponibilidad de horarios del negocio: lógica pura (sin Express ni Firestore).
// Genera slots reales a partir del horario de atención, la zona horaria del
// negocio, la duración solicitada y las citas activas, sin inventar huecos.

import { addDays, isValidLocalDate, localToUtc } from "./timezone.js";

export const DEFAULT_SLOT_STEP_MINUTES = 30;
export const MAX_AVAILABILITY_DAYS = 31;
export const MAX_AVAILABILITY_SLOTS = 300;
export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 480;
export const MIN_STEP_MINUTES = 5;
export const MAX_STEP_MINUTES = 240;

// Lunes (1) a sábado (6) de 09:00 a 18:00; domingo (7) cerrado.
export const DEFAULT_OPENING_HOURS = Object.freeze(
  [1, 2, 3, 4, 5, 6].map((day) => Object.freeze({ day, open: "09:00", close: "18:00" })),
);

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;
const pad = (value) => String(value).padStart(2, "0");
export const MAX_DATE_OVERRIDES = 120;

// Excepciones por fecha guardadas en el negocio. Lee solo las válidas: valores
// viejos/corruptos se ignoran para no romper la agenda.
export function resolveDateOverrides(tenant) {
  const raw = Array.isArray(tenant?.dateOverrides) ? tenant.dateOverrides : [];
  const seen = new Set();
  const normalized = [];

  for (const entry of raw.slice(0, MAX_DATE_OVERRIDES)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const date = typeof entry.date === "string" ? entry.date.trim() : "";
    if (!isValidLocalDate(date) || seen.has(date)) continue;

    if (entry.closed === true) {
      seen.add(date);
      normalized.push({ date, closed: true });
      continue;
    }
    if (entry.closed !== undefined && entry.closed !== false) continue;

    const openMinutes = parseTimeToMinutes(entry.open);
    const closeMinutes = parseTimeToMinutes(entry.close);
    if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) continue;
    seen.add(date);
    normalized.push({
      date,
      closed: false,
      open: minutesToTime(openMinutes),
      close: minutesToTime(closeMinutes),
    });
  }

  return normalized.sort((a, b) => a.date.localeCompare(b.date));
}

// Validación del PATCH: reemplaza la lista completa. Acepta el array o {dateOverrides}.
export function validateDateOverrides(body) {
  const list = Array.isArray(body) ? body : body?.dateOverrides;
  if (!Array.isArray(list)) {
    return invalidDateOverride("invalid_date_overrides", "La lista de fechas especiales no es válida.");
  }
  if (list.length > MAX_DATE_OVERRIDES) {
    return invalidDateOverride("invalid_date_overrides", `Puedes guardar como máximo ${MAX_DATE_OVERRIDES} fechas especiales.`);
  }

  const seen = new Set();
  const value = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return invalidDateOverride("invalid_date_overrides", "Cada fecha especial debe ser un objeto válido.");
    }
    const date = typeof entry.date === "string" ? entry.date.trim() : "";
    if (!isValidLocalDate(date)) {
      return invalidDateOverride("invalid_override_date", "Cada fecha especial debe ser una fecha AAAA-MM-DD válida.");
    }
    if (seen.has(date)) {
      return invalidDateOverride("duplicate_override_date", "No puedes repetir la misma fecha especial.");
    }
    seen.add(date);

    const closed = entry.closed ?? false;
    if (typeof closed !== "boolean") {
      return invalidDateOverride("invalid_date_overrides", "El campo closed debe ser true o false.");
    }
    if (closed) {
      value.push({ date, closed: true });
      continue;
    }

    const openMinutes = parseTimeToMinutes(entry.open);
    const closeMinutes = parseTimeToMinutes(entry.close);
    if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) {
      return invalidDateOverride("invalid_override_hours", "Las horas de una fecha abierta deben ser válidas y open < close.");
    }
    value.push({
      date,
      closed: false,
      open: minutesToTime(openMinutes),
      close: minutesToTime(closeMinutes),
    });
  }

  value.sort((a, b) => a.date.localeCompare(b.date));
  return { ok: true, value };
}

// Horario efectivo de una fecha concreta: la excepción manda sobre el semanal.
export function resolveEffectiveWindows(tenant, dateString) {
  if (!isValidLocalDate(dateString)) return [];

  const override = resolveDateOverrides(tenant).find((entry) => entry.date === dateString);
  if (override) {
    return override.closed ? [] : [{ open: override.open, close: override.close }];
  }

  const dayNumber = businessDayNumber(dateString);
  return resolveOpeningHours(tenant)
    .filter((entry) => entry.day === dayNumber)
    .sort((a, b) => parseTimeToMinutes(a.open) - parseTimeToMinutes(b.open))
    .map((entry) => ({ open: entry.open, close: entry.close }));
}

// ¿La hora pedida cae dentro de alguno de los tramos efectivos de esa fecha?
export function isWithinEffectiveWindows({ windows, startsAtLocal, durationMinutes }) {
  if (typeof startsAtLocal !== "string" || startsAtLocal.length < 16) return false;
  const startMinutes = parseTimeToMinutes(startsAtLocal.slice(11, 16));
  if (startMinutes === null || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return false;
  return (Array.isArray(windows) ? windows : []).some((window) => {
    const openMinutes = parseTimeToMinutes(window?.open);
    const closeMinutes = parseTimeToMinutes(window?.close);
    if (openMinutes === null || closeMinutes === null) return false;
    return startMinutes >= openMinutes && startMinutes + durationMinutes <= closeMinutes;
  });
}

// Validación de la reserva del panel (crear/reprogramar) contra el horario efectivo.
export function validateAppointmentWindow({ tenant, startsAtLocal, durationMinutes }) {
  const date = typeof startsAtLocal === "string" ? startsAtLocal.slice(0, 10) : "";
  const windows = resolveEffectiveWindows(tenant, date);
  if (isWithinEffectiveWindows({ windows, startsAtLocal, durationMinutes })) return { ok: true };
  return {
    ok: false,
    status: 400,
    code: "outside_business_hours",
    message: "La hora no está disponible dentro del horario de atención.",
  };
}

// Valida y normaliza el horario de atención. Sin valor usa el horario por defecto.
export function normalizeOpeningHours(value) {
  if (value === undefined) return { ok: true, value: DEFAULT_OPENING_HOURS };
  if (!Array.isArray(value)) return invalidOpeningHours();

  const normalized = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return invalidOpeningHours();
    if (!Number.isInteger(entry.day) || entry.day < 1 || entry.day > 7) return invalidOpeningHours();
    const openMinutes = parseTimeToMinutes(entry.open);
    const closeMinutes = parseTimeToMinutes(entry.close);
    if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) return invalidOpeningHours();
    normalized.push({ day: entry.day, open: minutesToTime(openMinutes), close: minutesToTime(closeMinutes) });
  }
  normalized.sort((a, b) => a.day - b.day || parseTimeToMinutes(a.open) - parseTimeToMinutes(b.open));
  return { ok: true, value: normalized };
}

// Horario efectivo de un negocio: el guardado o el valor por defecto para
// tenants antiguos que aún no tienen el campo.
export function resolveOpeningHours(tenant) {
  const result = normalizeOpeningHours(tenant?.openingHours);
  return result.ok ? result.value : DEFAULT_OPENING_HOURS;
}

export function resolveSlotStepMinutes(tenant) {
  const value = tenant?.slotStepMinutes;
  if (Number.isInteger(value) && value >= MIN_STEP_MINUTES && value <= MAX_STEP_MINUTES) return value;
  return DEFAULT_SLOT_STEP_MINUTES;
}

// Validación pura del PATCH del horario del negocio:
// - un rango por día como máximo (día repetido -> invalid_hours)
// - open < close y horas HH:MM válidas
// - slotStepMinutes entero 5-240
// - sin ninguno de los dos campos -> empty_update
export function validateTenantScheduleUpdate(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const hasOpeningHours = input.openingHours !== undefined;
  const hasSlotStepMinutes = input.slotStepMinutes !== undefined;

  if (!hasOpeningHours && !hasSlotStepMinutes) {
    return invalid("empty_update", "Indica openingHours o slotStepMinutes.");
  }

  const value = {};
  if (hasOpeningHours) {
    const normalized = normalizeOpeningHours(input.openingHours);
    if (!normalized.ok) {
      return invalid("invalid_hours", "El horario no es válido: días 1-7 y horas HH:MM con apertura menor que cierre.");
    }
    const days = new Set();
    for (const entry of normalized.value) {
      if (days.has(entry.day)) return invalid("invalid_hours", "Solo se permite un rango por día.");
      days.add(entry.day);
    }
    value.openingHours = normalized.value;
  }

  if (hasSlotStepMinutes) {
    const step = input.slotStepMinutes;
    if (!Number.isInteger(step) || step < MIN_STEP_MINUTES || step > MAX_STEP_MINUTES) {
      return invalid("invalid_slot_step", `El intervalo entre citas debe ser un entero entre ${MIN_STEP_MINUTES} y ${MAX_STEP_MINUTES} minutos.`);
    }
    value.slotStepMinutes = step;
  }

  return { ok: true, value };
}

export function validateAvailabilityQuery(query, { defaultStepMinutes = DEFAULT_SLOT_STEP_MINUTES } = {}) {
  const from = typeof query?.from === "string" ? query.from.trim() : "";
  const to = typeof query?.to === "string" ? query.to.trim() : "";
  if (!isValidLocalDate(from) || !isValidLocalDate(to) || from > to) {
    return invalid("invalid_range", "Indica un rango de fechas válido (from y to con formato AAAA-MM-DD).");
  }
  if (daysBetween(from, to) > MAX_AVAILABILITY_DAYS) {
    return invalid("invalid_range", `El rango de fechas no puede superar ${MAX_AVAILABILITY_DAYS} días.`);
  }

  const durationMinutes = parseIntegerParam(query?.durationMinutes);
  if (durationMinutes === null || durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
    return invalid("invalid_duration", "La duración debe ser un entero entre 5 y 480 minutos.");
  }

  let stepMinutes = defaultStepMinutes;
  if (query?.stepMinutes !== undefined && query.stepMinutes !== "") {
    const parsedStep = parseIntegerParam(query.stepMinutes);
    if (parsedStep === null || parsedStep < MIN_STEP_MINUTES || parsedStep > MAX_STEP_MINUTES) {
      return invalid("invalid_step", "El paso entre horarios debe ser un entero entre 5 y 240 minutos.");
    }
    stepMinutes = parsedStep;
  }

  return { ok: true, value: { from, to, durationMinutes, stepMinutes } };
}

// Genera los horarios libres del rango [from, to] (fechas locales del negocio).
// - Solo dentro de openingHours.
// - Nunca antes de `now` (reloj inyectable en las pruebas).
// - Excluye cualquier slot que se cruce con una cita activa (`busy`).
// - Devuelve como máximo maxSlots, ordenados por inicio ascendente.
export function generateAvailabilitySlots({
  from,
  to,
  timeZone,
  openingHours = DEFAULT_OPENING_HOURS,
  dateOverrides = null,
  durationMinutes,
  stepMinutes,
  now = new Date(),
  busy = [],
  maxSlots = MAX_AVAILABILITY_SLOTS,
}) {
  if (!isValidLocalDate(from) || !isValidLocalDate(to) || from > to) throw new RangeError("invalid_range");
  if (!Number.isInteger(durationMinutes) || durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
    throw new RangeError("invalid_duration");
  }
  if (!Number.isInteger(stepMinutes) || stepMinutes < MIN_STEP_MINUTES || stepMinutes > MAX_STEP_MINUTES) {
    throw new RangeError("invalid_step");
  }

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const busyRanges = normalizeBusyRanges(busy);
  const durationMs = durationMinutes * 60 * 1000;
  const slots = [];
  const seen = new Set();

  let currentDate = from;
  while (currentDate <= to) {
    // La excepción por fecha manda sobre el horario semanal.
    const windows = dateOverrides !== null
      ? resolveEffectiveWindows({ openingHours, dateOverrides }, currentDate)
      : openingHours
        .filter((entry) => entry.day === businessDayNumber(currentDate))
        .sort((a, b) => parseTimeToMinutes(a.open) - parseTimeToMinutes(b.open));

    for (const window of windows) {
      const openMinutes = parseTimeToMinutes(window.open);
      const closeMinutes = parseTimeToMinutes(window.close);
      if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) continue;

      for (let minute = openMinutes; minute + durationMinutes <= closeMinutes; minute += stepMinutes) {
        const startsAtLocal = `${currentDate}T${minutesToTime(minute)}`;
        const startsAt = localToUtc(startsAtLocal, timeZone);
        const startMs = startsAt.getTime();
        if (startMs < nowMs || seen.has(startMs)) continue;
        const endMs = startMs + durationMs;
        if (busyRanges.some((range) => startMs < range.endMs && range.startMs < endMs)) continue;
        seen.add(startMs);
        slots.push({ startsAt, startsAtLocal });
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return slots.slice(0, maxSlots);
}

// 1 = lunes … 7 = domingo.
export function businessDayNumber(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}

function normalizeBusyRanges(busy) {
  if (!Array.isArray(busy)) return [];
  return busy
    .map((item) => ({
      startMs: toMillis(item?.startMs ?? item?.start),
      endMs: toMillis(item?.endMs ?? item?.end),
    }))
    .filter((range) => range.startMs !== null && range.endMs !== null && range.endMs > range.startMs);
}

function toMillis(value) {
  if (value === null || value === undefined) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function daysBetween(from, to) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000);
}

function parseIntegerParam(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesToTime(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function invalidDateOverride(code, message) {
  return { ok: false, status: 400, code, message };
}

function invalidOpeningHours() {
  return {
    ok: false,
    code: "invalid_opening_hours",
    message: "El horario debe ser una lista de tramos { day: 1-7, open: \"HH:mm\", close: \"HH:mm\" }.",
  };
}

function invalid(code, message) {
  return { ok: false, code, message };
}

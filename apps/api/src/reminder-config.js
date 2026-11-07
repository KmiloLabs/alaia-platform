// Configuración y cálculo de recordatorios: lógica pura (sin Firestore ni
// Express) para validar, resolver defaults, calcular sendAt e interpolar.

export const DEFAULT_REMINDER_MESSAGE = "Hola {nombre}, te recordamos tu cita en {negocio} el {fecha} a las {hora} ({servicio}). Responde SI para confirmar.";
export const MAX_REMINDER_MESSAGE_LENGTH = 300;
export const MAX_REMINDER_HOURS = 168;
export const REMINDER_KINDS = Object.freeze(["first", "second"]);
export const ALLOWED_REMINDER_VARIABLES = Object.freeze(["nombre", "negocio", "fecha", "hora", "servicio"]);
export const DEFAULT_REMINDERS = Object.freeze({
  enabled: false,
  firstHoursBefore: 24,
  secondHoursBefore: 2,
  message: DEFAULT_REMINDER_MESSAGE,
});

const VARIABLE_PATTERN = /\{([^{}]+)\}/g;
const ALLOWED_VARIABLES = new Set(ALLOWED_REMINDER_VARIABLES);

// Configuración efectiva: valores guardados válidos o defaults por campo.
export function resolveReminders(tenant) {
  const raw = tenant?.reminders && typeof tenant.reminders === "object" && !Array.isArray(tenant.reminders)
    ? tenant.reminders
    : {};
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_REMINDERS.enabled,
    firstHoursBefore: normalizeHours(raw.firstHoursBefore, DEFAULT_REMINDERS.firstHoursBefore),
    secondHoursBefore: normalizeHours(raw.secondHoursBefore, DEFAULT_REMINDERS.secondHoursBefore),
    message: normalizeMessage(raw.message) ?? DEFAULT_REMINDERS.message,
  };
}

// Valida y normaliza el PATCH de recordatorios. Acepta {reminders:{...}} o el objeto.
export function validateReminders(body) {
  const input = body?.reminders !== undefined ? body.reminders : body;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalid("invalid_reminders", "La configuración de recordatorios no es válida.");
  }

  const enabled = input.enabled === undefined ? DEFAULT_REMINDERS.enabled : input.enabled;
  if (typeof enabled !== "boolean") {
    return invalid("invalid_reminders", "El campo enabled debe ser true o false.");
  }

  const firstHoursBefore = input.firstHoursBefore === undefined
    ? DEFAULT_REMINDERS.firstHoursBefore
    : input.firstHoursBefore;
  const secondHoursBefore = input.secondHoursBefore === undefined
    ? DEFAULT_REMINDERS.secondHoursBefore
    : input.secondHoursBefore;
  if (!isValidHours(firstHoursBefore) || !isValidHours(secondHoursBefore)) {
    return invalid("invalid_reminders", `Los avisos deben ser enteros entre 0 y ${MAX_REMINDER_HOURS} horas.`);
  }

  if (enabled && firstHoursBefore === 0 && secondHoursBefore === 0) {
    return invalid("invalid_reminder_schedule", "Activa al menos un aviso (primer o segundo).");
  }

  const rawMessage = input.message === undefined ? DEFAULT_REMINDERS.message : input.message;
  const message = normalizeMessage(rawMessage);
  if (message === null) {
    return invalid("invalid_reminder_message", `El mensaje debe ser texto de máximo ${MAX_REMINDER_MESSAGE_LENGTH} caracteres con variables válidas.`);
  }

  return {
    ok: true,
    value: { enabled, firstHoursBefore, secondHoursBefore, message },
  };
}

// Horas antes -> sendAt. No programa avisos cuyo sendAt ya pasó.
export function computeReminderSchedule({ reminders, startsAt, now = new Date() }) {
  const config = reminders && typeof reminders === "object" ? reminders : DEFAULT_REMINDERS;
  if (config.enabled !== true) return [];

  const startsAtMs = startsAt instanceof Date ? startsAt.getTime() : new Date(startsAt).getTime();
  if (!Number.isFinite(startsAtMs)) return [];
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (startsAtMs <= nowMs) return [];

  const schedule = [];
  const firstHours = normalizeHours(config.firstHoursBefore, 0);
  const secondHours = normalizeHours(config.secondHoursBefore, 0);
  for (const [kind, hours] of [["first", firstHours], ["second", secondHours]]) {
    if (hours <= 0) continue;
    const sendAtMs = startsAtMs - hours * 60 * 60 * 1000;
    if (sendAtMs <= nowMs) continue;
    schedule.push({ kind, sendAt: new Date(sendAtMs) });
  }
  return schedule;
}

// Interpola el mensaje con los datos de la cita. Variables desconocidas quedan
// intactas (la validación ya las rechazó al guardar).
export function renderReminderMessage(template, variables = {}) {
  const text = typeof template === "string" ? template : DEFAULT_REMINDER_MESSAGE;
  return text.replace(VARIABLE_PATTERN, (match, name) => {
    if (!ALLOWED_VARIABLES.has(name)) return match;
    const value = variables[name];
    return typeof value === "string" ? value : "";
  });
}

export function reminderMessageVariables({ tenantName, appointment }) {
  const startsAtLocal = typeof appointment?.startsAtLocal === "string" ? appointment.startsAtLocal : "";
  return {
    nombre: typeof appointment?.customerName === "string" ? appointment.customerName : "",
    negocio: typeof tenantName === "string" ? tenantName : "",
    fecha: startsAtLocal.slice(0, 10),
    hora: startsAtLocal.slice(11, 16),
    servicio: typeof appointment?.serviceName === "string" ? appointment.serviceName : "",
  };
}

function normalizeHours(value, fallback) {
  return isValidHours(value) ? value : fallback;
}

function isValidHours(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_REMINDER_HOURS;
}

function normalizeMessage(value) {
  if (typeof value !== "string") return null;
  const message = value.trim();
  if (message === "" || message.length > MAX_REMINDER_MESSAGE_LENGTH) return null;
  for (const match of message.matchAll(VARIABLE_PATTERN)) {
    if (!ALLOWED_VARIABLES.has(match[1])) return null;
  }
  return message;
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

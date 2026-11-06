// Prompt del sistema compuesto en el servidor: contexto real del negocio
// (zona horaria, fecha actual, horario) más las instrucciones y el tono del
// dueño. Sin datos quemados de otros negocios ni de la clínica dental de n8n.

import { resolveOpeningHours } from "../availability.js";
import { isValidTimeZone, utcToLocalDate, utcToLocalDateTime } from "../timezone.js";

const FALLBACK_TIME_ZONE = "America/Bogota";
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const ALLOWED_ACTIONS = "responder|ofrecer_horarios|reservar|reprogramar|cancelar|derivar";
const MAX_SERVICES_IN_PROMPT = 15;

export function buildAgentSystemPrompt({ tenant, config, services = [], now = new Date() }) {
  const name = typeof tenant?.name === "string" && tenant.name.trim() !== "" ? tenant.name.trim() : "el negocio";
  const timeZone = isValidTimeZone(tenant?.timeZone) ? tenant.timeZone : FALLBACK_TIME_ZONE;
  const openingHours = resolveOpeningHours(tenant);
  const currentLocal = utcToLocalDateTime(now, timeZone).replace("T", " ");
  const currentDate = utcToLocalDate(now, timeZone);
  const humanNow = formatHumanDateTime(now, timeZone);
  const tone = typeof config?.tone === "string" && config.tone.trim() !== "" ? config.tone.trim() : "cercano";
  const instructions = typeof config?.instructions === "string" && config.instructions.trim() !== ""
    ? config.instructions.trim()
    : "(sin instrucciones adicionales)";
  const serviceLines = (Array.isArray(services) ? services : [])
    .slice(0, MAX_SERVICES_IN_PROMPT)
    .map(formatServiceLine)
    .filter(Boolean);
  const contactLines = buildContactLines(tenant);

  return [
    `Eres el asistente de recepción de ${name} y atiendes a clientes por escrito.`,
    `Negocio: ${name}. Zona horaria del negocio: ${timeZone}.`,
    `Fecha y hora actuales en el negocio: ${humanNow} (${currentLocal}; fecha local ${currentDate}).`,
    `Horario de atención: ${formatOpeningHours(openingHours)}.`,
    `Servicios activos: ${serviceLines.length > 0 ? serviceLines.join("; ") : "(sin servicios configurados)"}.`,
    ...(contactLines.length > 0 ? [`Información del negocio: ${contactLines.join(" ")}`] : []),
    `Tono de atención: ${tone}.`,
    `Instrucciones del negocio: ${instructions}`,
    "Reglas:",
    "- Responde en español, breve (máximo 3 frases), sin markdown y con un emoji como máximo.",
    "- No inventes precios, horarios, disponibilidad ni historial: usa las herramientas y responde solo con lo que devuelvan.",
    "- Usa consultar_servicios para conocer el catálogo y no cotices distinto al catálogo; si el servicio no está, dilo y ofrece transferir a una persona.",
    "- Al reservar un servicio del catálogo, pasa crear_cita con serviceId: el backend fija el nombre, la duración y el precio.",
    "- Para reservar, pide nombre y teléfono si el cliente no los dio; pasa customerName y customerPhone a crear_cita.",
    "- Usa buscar_cliente antes de crear la cita cuando el cliente diga que ya ha venido o mencione un teléfono.",
    "- No inventes datos del cliente ni reutilices el teléfono de otra persona.",
    "- Antes de crear, reprogramar o cancelar una cita, pide confirmación explícita al cliente; ejecuta la acción solo cuando la haya confirmado en la conversación.",
    "- Si falta un dato (nombre, servicio, fecha, hora), pídelo antes de reservar.",
    "- No compartas identificadores técnicos, datos internos ni información de otros clientes.",
    "- Si preguntan dónde queda el negocio, el teléfono o las redes, usa \"Información del negocio\"; si ese dato no está, di que lo confirmas con una persona y deriva.",
    "- Deriva a una persona con derivar_a_persona ante urgencias, quejas o temas fuera de alcance.",
    `- Responde SIEMPRE con un único objeto JSON válido, sin texto alrededor: {"reply": "texto para el cliente", "action": "${ALLOWED_ACTIONS}"}. No añadas claves adicionales.`,
  ].join("\n");
}

export function buildContactLines(tenant) {
  const lines = [];
  const address = typeof tenant?.address === "string" ? tenant.address.trim() : "";
  const phone = typeof tenant?.phone === "string" ? tenant.phone.trim() : "";
  const description = typeof tenant?.description === "string" ? tenant.description.trim() : "";
  if (address) lines.push(`Dirección: ${address}.`);
  if (phone) lines.push(`Teléfono: ${phone}.`);
  if (description) lines.push(`Descripción: ${description}.`);
  const social = tenant?.socialLinks && typeof tenant.socialLinks === "object" ? tenant.socialLinks : {};
  const socialParts = [];
  for (const key of ["instagram", "facebook", "tiktok", "whatsapp", "website"]) {
    const value = typeof social[key] === "string" ? social[key].trim() : "";
    if (value) socialParts.push(`${key}: ${value}`);
  }
  if (socialParts.length > 0) lines.push(`Redes: ${socialParts.join(", ")}.`);
  return lines;
}

export function formatServiceLine(service) {
  if (!service || typeof service.name !== "string" || service.name.trim() === "") return "";
  const price = Number.isInteger(service.priceCOP) ? formatCOP(service.priceCOP) : "precio no disponible";
  const duration = Number.isInteger(service.durationMinutes) ? `${service.durationMinutes} min` : "duración no disponible";
  const id = typeof service.serviceId === "string" ? ` (id: ${service.serviceId})` : "";
  return `${service.name} — ${duration} — $${price}${id}`;
}

export function formatCOP(value) {
  return new Intl.NumberFormat("es-CO").format(value);
}

export function formatOpeningHours(openingHours) {
  const byDay = new Map();
  for (const entry of openingHours) {
    if (!entry || !Number.isInteger(entry.day)) continue;
    if (!byDay.has(entry.day)) byDay.set(entry.day, []);
    byDay.get(entry.day).push(`${entry.open}-${entry.close}`);
  }
  const parts = [];
  for (let day = 1; day <= 7; day += 1) {
    const ranges = byDay.get(day);
    parts.push(ranges && ranges.length > 0
      ? `${DAY_NAMES[day - 1]} ${ranges.join(" y ")}`
      : `${DAY_NAMES[day - 1]} cerrado`);
  }
  return parts.join("; ");
}

export function formatHumanDateTime(date, timeZone) {
  try {
    return new Intl.DateTimeFormat("es-CO", {
      timeZone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

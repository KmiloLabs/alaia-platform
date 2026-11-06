// Herramientas del agente. Se ejecutan en el servidor con el tenantId de la ruta
// (el modelo nunca lo aporta) y reutilizan el servicio de agenda: mismas reglas,
// misma transacción, mismos códigos de error. Validación estricta de argumentos.

import {
  addDays,
  formatLocalDateTime,
  isValidLocalDate,
  isValidLocalDateTime,
  isValidTimeZone,
  parseLocalDateTime,
  utcToLocalDate,
} from "../timezone.js";

const MAX_AGENDA_RESULTS = 20;
const MAX_AVAILABILITY_RESULTS = 12;
const DEFAULT_DURATION_MINUTES = 45;
const FALLBACK_TIME_ZONE = "America/Bogota";
const APPOINTMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Las dependencias reales (servicio de agenda con Firestore) se cargan de forma
// perezosa para que las pruebas unitarias puedan inyectar dobles sin tocar
// Firebase. En producción executeTool no recibe deps y usa el servicio real.
let defaultDepsPromise = null;
async function loadDefaultDeps() {
  if (!defaultDepsPromise) {
    defaultDepsPromise = import("../appointment-service.js").then((service) => ({
      getAvailability: service.getAvailability,
      listAppointments: service.listAppointments,
      createAppointment: service.createAppointment,
      rescheduleAppointment: service.rescheduleAppointment,
      cancelAppointment: service.cancelAppointment,
      now: () => new Date(),
    }));
  }
  return defaultDepsPromise;
}

export const AGENT_TOOLS = Object.freeze([
  {
    name: "consultar_disponibilidad",
    description: "Consulta horarios libres del negocio en un rango de fechas local y una duración. Úsala antes de ofrecer horarios.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Fecha inicial local AAAA-MM-DD. Por defecto hoy." },
        to: { type: "string", description: "Fecha final local AAAA-MM-DD. Por defecto hoy + 6 días." },
        durationMinutes: { type: "integer", description: "Duración en minutos (5-480). Por defecto 45." },
        stepMinutes: { type: "integer", description: "Paso entre horarios en minutos (5-240). Opcional." },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "consultar_agenda",
    description: "Lista las citas del negocio en un rango de fechas local. Úsala para saber qué citas existen.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Fecha inicial local AAAA-MM-DD. Por defecto hoy." },
        to: { type: "string", description: "Fecha final local AAAA-MM-DD. Por defecto hoy + 6 días." },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "crear_cita",
    description: "Crea una cita. Solo después de que el cliente confirme nombre, servicio y horario.",
    parameters: {
      type: "object",
      properties: {
        customerName: { type: "string", description: "Nombre del cliente (2-80 caracteres)." },
        serviceName: { type: "string", description: "Servicio solicitado (2-80 caracteres)." },
        startsAt: { type: "string", description: "Inicio en hora local del negocio AAAA-MM-DDTHH:mm." },
        durationMinutes: { type: "integer", description: "Duración en minutos (5-480). Por defecto 45." },
        priceCOP: { type: "integer", description: "Precio acordado en COP (0-10000000). Por defecto 0." },
        customerPhone: { type: "string", description: "Teléfono del cliente. Opcional." },
        notes: { type: "string", description: "Notas breves. Opcional." },
        clientRequestId: { type: "string", description: "Clave de idempotencia. Opcional." },
      },
      required: ["customerName", "serviceName", "startsAt"],
      additionalProperties: false,
    },
  },
  {
    name: "reprogramar_cita",
    description: "Mueve una cita existente a un nuevo horario local. Solo con confirmación del cliente.",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "ID de la cita a mover." },
        startsAt: { type: "string", description: "Nuevo inicio en hora local AAAA-MM-DDTHH:mm." },
        durationMinutes: { type: "integer", description: "Nueva duración en minutos (5-480). Opcional." },
      },
      required: ["appointmentId", "startsAt"],
      additionalProperties: false,
    },
  },
  {
    name: "cancelar_cita",
    description: "Cancela una cita existente. Solo con confirmación del cliente.",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "ID de la cita a cancelar." },
      },
      required: ["appointmentId"],
      additionalProperties: false,
    },
  },
  {
    name: "derivar_a_persona",
    description: "Deriva la conversación a una persona del negocio (urgencias, quejas o fuera de alcance).",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Motivo breve de la derivación." },
      },
      required: [],
      additionalProperties: false,
    },
  },
]);

export async function executeTool(name, rawArguments, context, deps) {
  const resolvedDeps = deps ?? await loadDefaultDeps();
  const args = rawArguments && typeof rawArguments === "object" && !Array.isArray(rawArguments)
    ? rawArguments
    : {};

  if (typeof name !== "string" || !AGENT_TOOLS.some((tool) => tool.name === name)) {
    return toolError("unknown_tool", "La herramienta solicitada no existe.");
  }

  try {
    switch (name) {
      case "consultar_disponibilidad":
        return await consultarDisponibilidad(args, context, resolvedDeps);
      case "consultar_agenda":
        return await consultarAgenda(args, context, resolvedDeps);
      case "crear_cita":
        return await crearCita(args, context, resolvedDeps);
      case "reprogramar_cita":
        return await reprogramarCita(args, context, resolvedDeps);
      case "cancelar_cita":
        return await cancelarCita(args, context, resolvedDeps);
      case "derivar_a_persona":
        return derivarAPersona(args);
      default:
        return toolError("unknown_tool", "La herramienta solicitada no existe.");
    }
  } catch {
    // Nunca exponemos detalles internos al modelo.
    return toolError("tool_failed", "No se pudo ejecutar la herramienta.");
  }
}

async function consultarDisponibilidad(args, context, deps) {
  const timeZone = resolveTenantTimeZone(context.tenant);
  const defaultRange = defaultDateRange(timeZone, deps);
  const from = optionalLocalDate(args.from) ?? defaultRange.from;
  const to = optionalLocalDate(args.to) ?? defaultRange.to;
  const durationMinutes = optionalInteger(args.durationMinutes, { min: 5, max: 480, fallback: DEFAULT_DURATION_MINUTES });
  const stepMinutes = optionalInteger(args.stepMinutes, { min: 5, max: 240, fallback: null });
  if (from instanceof ToolArgumentError) return from.toResult();
  if (to instanceof ToolArgumentError) return to.toResult();
  if (durationMinutes instanceof ToolArgumentError) return durationMinutes.toResult();
  if (stepMinutes instanceof ToolArgumentError) return stepMinutes.toResult();

  const query = { from, to, durationMinutes };
  if (stepMinutes !== null) query.stepMinutes = String(stepMinutes);

  const result = await deps.getAvailability({ tenant: context.tenant, query });
  if (!result.ok) return serviceError(result);
  return {
    ok: true,
    data: {
      timeZone: result.timeZone,
      durationMinutes: result.durationMinutes,
      stepMinutes: result.stepMinutes,
      count: result.slots.length,
      slots: result.slots.slice(0, MAX_AVAILABILITY_RESULTS),
    },
  };
}

async function consultarAgenda(args, context, deps) {
  const timeZone = resolveTenantTimeZone(context.tenant);
  const defaultRange = defaultDateRange(timeZone, deps);
  const from = optionalLocalDate(args.from) ?? defaultRange.from;
  const to = optionalLocalDate(args.to) ?? defaultRange.to;
  if (from instanceof ToolArgumentError) return from.toResult();
  if (to instanceof ToolArgumentError) return to.toResult();

  const result = await deps.listAppointments({ tenantId: context.tenant.id, timeZone, query: { from, to } });
  if (!result.ok) return serviceError(result);
  return {
    ok: true,
    data: {
      from,
      to,
      count: result.appointments.length,
      appointments: result.appointments.slice(0, MAX_AGENDA_RESULTS).map((appointment) => ({
        appointmentId: appointment.appointmentId,
        customerName: appointment.customerName,
        serviceName: appointment.serviceName,
        startsAtLocal: appointment.startsAtLocal,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status,
      })),
    },
  };
}

async function crearCita(args, context, deps) {
  const customerName = requiredString(args.customerName, { min: 2, max: 80, field: "customerName" });
  if (customerName instanceof ToolArgumentError) return customerName.toResult();
  const serviceName = requiredString(args.serviceName, { min: 2, max: 80, field: "serviceName" });
  if (serviceName instanceof ToolArgumentError) return serviceName.toResult();
  const startsAt = requiredLocalDateTime(args.startsAt, "startsAt");
  if (startsAt instanceof ToolArgumentError) return startsAt.toResult();
  const durationMinutes = optionalInteger(args.durationMinutes, { min: 5, max: 480, fallback: DEFAULT_DURATION_MINUTES });
  if (durationMinutes instanceof ToolArgumentError) return durationMinutes.toResult();
  const priceCOP = optionalInteger(args.priceCOP, { min: 0, max: 10_000_000, fallback: 0 });
  if (priceCOP instanceof ToolArgumentError) return priceCOP.toResult();
  const customerPhone = optionalString(args.customerPhone, 40);
  if (customerPhone instanceof ToolArgumentError) return customerPhone.toResult();
  const notes = optionalString(args.notes, 500);
  if (notes instanceof ToolArgumentError) return notes.toResult();
  const explicitRequestId = optionalString(args.clientRequestId, 200);
  if (explicitRequestId instanceof ToolArgumentError) return explicitRequestId.toResult();

  const clientRequestId = explicitRequestId
    ?? `agent-${context.conversationId ?? "manual"}-${startsAt}`;

  const result = await deps.createAppointment({
    tenantId: context.tenant.id,
    timeZone: resolveTenantTimeZone(context.tenant),
    actorUid: context.actorUid,
    body: {
      customerName,
      serviceName,
      startsAt,
      durationMinutes,
      priceCOP,
      customerPhone: customerPhone || null,
      notes: notes ?? "",
      clientRequestId,
    },
  });
  if (!result.ok) return serviceError(result);
  return { ok: true, data: { appointment: result.appointment, created: result.created } };
}

async function reprogramarCita(args, context, deps) {
  const appointmentId = requiredString(args.appointmentId, { min: 1, max: 128, field: "appointmentId" });
  if (appointmentId instanceof ToolArgumentError) return appointmentId.toResult();
  if (!isValidAppointmentId(appointmentId)) return toolError("invalid_arguments", "El appointmentId no es válido.");
  const startsAt = requiredLocalDateTime(args.startsAt, "startsAt");
  if (startsAt instanceof ToolArgumentError) return startsAt.toResult();
  const durationMinutes = optionalInteger(args.durationMinutes, { min: 5, max: 480, fallback: null });
  if (durationMinutes instanceof ToolArgumentError) return durationMinutes.toResult();

  const body = { startsAt };
  if (durationMinutes !== null) body.durationMinutes = durationMinutes;

  const result = await deps.rescheduleAppointment({
    tenantId: context.tenant.id,
    timeZone: resolveTenantTimeZone(context.tenant),
    actorUid: context.actorUid,
    appointmentId,
    body,
  });
  if (!result.ok) return serviceError(result);
  return { ok: true, data: { appointment: result.appointment } };
}

async function cancelarCita(args, context, deps) {
  const appointmentId = requiredString(args.appointmentId, { min: 1, max: 128, field: "appointmentId" });
  if (appointmentId instanceof ToolArgumentError) return appointmentId.toResult();
  if (!isValidAppointmentId(appointmentId)) return toolError("invalid_arguments", "El appointmentId no es válido.");

  const result = await deps.cancelAppointment({
    tenantId: context.tenant.id,
    actorUid: context.actorUid,
    appointmentId,
  });
  if (!result.ok) return serviceError(result);
  return { ok: true, data: { appointment: result.appointment } };
}

function derivarAPersona(args) {
  const reason = optionalString(args.reason, 200);
  if (reason instanceof ToolArgumentError) return reason.toResult();
  return { ok: true, data: { handoff: true, reason: reason ?? "" } };
}

class ToolArgumentError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolArgumentError";
  }

  toResult() {
    return toolError("invalid_arguments", this.message);
  }
}

function defaultDateRange(timeZone, deps) {
  const today = utcToLocalDate(deps.now(), timeZone);
  return { from: today, to: addDays(today, 6) };
}

function resolveTenantTimeZone(tenant) {
  return isValidTimeZone(tenant?.timeZone) ? tenant.timeZone : FALLBACK_TIME_ZONE;
}

function isValidAppointmentId(appointmentId) {
  return typeof appointmentId === "string" && APPOINTMENT_ID_PATTERN.test(appointmentId);
}

function requiredString(value, { min, max, field }) {
  if (typeof value !== "string" || value.trim() === "") {
    return new ToolArgumentError(`Falta ${field} o no es texto.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return new ToolArgumentError(`${field} debe tener entre ${min} y ${max} caracteres.`);
  }
  return trimmed;
}

function optionalString(value, maxLength) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return new ToolArgumentError("Se esperaba texto en un campo opcional.");
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return new ToolArgumentError(`El texto no puede superar ${maxLength} caracteres.`);
  return trimmed === "" ? null : trimmed;
}

function optionalInteger(value, { min, max, fallback }) {
  if (value === undefined || value === null || value === "") return fallback;
  if (!Number.isInteger(value)) return new ToolArgumentError("Se esperaba un número entero.");
  if (value < min || value > max) return new ToolArgumentError(`El número debe estar entre ${min} y ${max}.`);
  return value;
}

function optionalLocalDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !isValidLocalDate(value.trim())) {
    return new ToolArgumentError("La fecha debe tener formato AAAA-MM-DD.");
  }
  return value.trim();
}

function requiredLocalDateTime(value, field) {
  if (typeof value !== "string" || !isValidLocalDateTime(value.trim())) {
    return new ToolArgumentError(`${field} debe venir como AAAA-MM-DDTHH:mm.`);
  }
  const parts = parseLocalDateTime(value.trim());
  return formatLocalDateTime(parts);
}

function serviceError(result) {
  return {
    ok: false,
    error: {
      code: typeof result.code === "string" ? result.code : "tool_failed",
      message: typeof result.message === "string" ? result.message : "No se pudo completar la acción.",
    },
  };
}

function toolError(code, message) {
  return { ok: false, error: { code, message } };
}

// Servicio de agenda reutilizable: rutas HTTP y herramientas del agente comparten
// exactamente las mismas reglas (tenant, zona horaria, transacciones y eventos).
// Devuelve resultados de dominio: { ok: true, ... } o { ok: false, status, code, message }.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { isValidTimeZone, localDateRangeToUtc } from "./timezone.js";
import {
  generateAvailabilitySlots,
  resolveOpeningHours,
  resolveSlotStepMinutes,
  validateAvailabilityQuery,
} from "./availability.js";
import {
  deriveAppointmentId,
  validateAppointmentInput,
  validateAppointmentRange,
  validateRescheduleInput,
} from "./appointment-validation.js";

const MAX_APPOINTMENT_DURATION_MS = 480 * 60 * 1000;
const FALLBACK_TIME_ZONE = "America/Bogota";
const APPOINTMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function resolveTenantTimeZone(tenant) {
  const timeZone = tenant?.timeZone;
  return isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
}

export function isValidAppointmentId(appointmentId) {
  return APPOINTMENT_ID_PATTERN.test(appointmentId);
}

export async function listAppointments({ tenantId, timeZone, query }) {
  const range = validateAppointmentRange(query, timeZone);
  if (!range.ok) return { ok: false, status: 400, code: range.code, message: range.message };

  const snapshot = await appointmentsRef(tenantId)
    .where("startsAt", ">=", Timestamp.fromDate(range.value.start))
    .where("startsAt", "<", Timestamp.fromDate(range.value.end))
    .orderBy("startsAt", "asc")
    .get();

  return { ok: true, appointments: snapshot.docs.map((doc) => serializeAppointment(doc.id, doc.data())) };
}

export async function getAvailability({ tenant, query, now = new Date() }) {
  const timeZone = resolveTenantTimeZone(tenant);
  const openingHours = resolveOpeningHours(tenant);
  const defaultStepMinutes = resolveSlotStepMinutes(tenant);
  const validation = validateAvailabilityQuery(query, { defaultStepMinutes });
  if (!validation.ok) return { ok: false, status: 400, code: validation.code, message: validation.message };

  const { from, to, durationMinutes, stepMinutes } = validation.value;
  const range = localDateRangeToUtc(from, to, timeZone);
  const snapshot = await appointmentsRef(tenant.id)
    .where("startsAt", ">=", Timestamp.fromMillis(range.start.getTime() - MAX_APPOINTMENT_DURATION_MS))
    .where("startsAt", "<", Timestamp.fromDate(range.end))
    .get();
  const busy = snapshot.docs
    .map((doc) => doc.data())
    .filter((data) => data.status === "scheduled")
    .map((data) => ({ start: toMillis(data.startsAt), end: toMillis(data.endsAt) }))
    .filter((item) => item.start !== null && item.end !== null);

  const slots = generateAvailabilitySlots({
    from,
    to,
    timeZone,
    openingHours,
    durationMinutes,
    stepMinutes,
    now,
    busy,
  });

  return {
    ok: true,
    timeZone,
    durationMinutes,
    stepMinutes,
    slots: slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      startsAtLocal: slot.startsAtLocal,
    })),
  };
}

export async function createAppointment({ tenantId, timeZone, actorUid, body }) {
  const validation = validateAppointmentInput(body, timeZone);
  if (!validation.ok) return { ok: false, status: 400, code: validation.code, message: validation.message };

  const input = validation.value;
  const appointments = appointmentsRef(tenantId);
  const appointmentRef = input.clientRequestId
    ? appointments.doc(deriveAppointmentId(input.clientRequestId))
    : appointments.doc();
  const startsAtMs = input.startsAtUtc.getTime();
  const endsAtMs = input.endsAtUtc.getTime();

  const outcome = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(appointmentRef);
    if (existing.exists) return { kind: "existing", snapshot: existing };

    // Consulta de un solo campo (sin índice compuesto) + filtro exacto en memoria:
    // cualquier cita activa con duración <= 480 min que se cruce empieza dentro
    // de [inicio - 480 min, fin).
    const window = await transaction.get(
      appointments
        .where("startsAt", ">=", Timestamp.fromMillis(startsAtMs - MAX_APPOINTMENT_DURATION_MS))
        .where("startsAt", "<", Timestamp.fromMillis(endsAtMs)),
    );
    const conflict = window.docs.some((doc) => {
      const data = doc.data();
      if (data.status !== "scheduled") return false;
      const otherStart = toMillis(data.startsAt);
      const otherEnd = toMillis(data.endsAt);
      if (otherStart === null || otherEnd === null) return false;
      return otherStart < endsAtMs && otherEnd > startsAtMs;
    });
    if (conflict) return { kind: "conflict" };

    transaction.create(appointmentRef, {
      tenantId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      serviceName: input.serviceName,
      startsAt: Timestamp.fromDate(input.startsAtUtc),
      startsAtLocal: input.startsAtLocal,
      endsAt: Timestamp.fromDate(input.endsAtUtc),
      durationMinutes: input.durationMinutes,
      priceCOP: input.priceCOP,
      status: "scheduled",
      notes: input.notes,
      clientRequestId: input.clientRequestId,
      timeZone,
      createdBy: actorUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(appointmentRef.collection("events").doc(), {
      type: "created",
      actorUid,
      at: FieldValue.serverTimestamp(),
    });
    return { kind: "created" };
  });

  if (outcome.kind === "conflict") {
    return {
      ok: false,
      status: 409,
      code: "appointment_conflict",
      message: "Ese horario se cruza con otra cita activa del negocio.",
    };
  }
  if (outcome.kind === "existing") {
    return {
      ok: true,
      created: false,
      appointment: serializeAppointment(appointmentRef.id, outcome.snapshot.data()),
    };
  }

  // Releemos para devolver el createdAt resuelto por el servidor.
  const created = await appointmentRef.get();
  return { ok: true, created: true, appointment: serializeAppointment(appointmentRef.id, created.data()) };
}

export async function cancelAppointment({ tenantId, actorUid, appointmentId }) {
  if (!isValidAppointmentId(appointmentId)) return appointmentNotFound();

  const appointmentRef = appointmentsRef(tenantId).doc(appointmentId);
  const outcome = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(appointmentRef);
    if (!snapshot.exists) return { kind: "missing" };

    const data = snapshot.data();
    if (data.status === "cancelled") return { kind: "already_cancelled", data };

    transaction.update(appointmentRef, {
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(appointmentRef.collection("events").doc(), {
      type: "cancelled",
      actorUid,
      at: FieldValue.serverTimestamp(),
    });
    return { kind: "cancelled", data: { ...data, status: "cancelled" } };
  });

  if (outcome.kind === "missing") return appointmentNotFound();
  return {
    ok: true,
    alreadyCancelled: outcome.kind === "already_cancelled",
    appointment: serializeAppointment(appointmentId, outcome.data),
  };
}

export async function rescheduleAppointment({ tenantId, timeZone, actorUid, appointmentId, body }) {
  if (!isValidAppointmentId(appointmentId)) return appointmentNotFound();

  const validation = validateRescheduleInput(body, timeZone);
  if (!validation.ok) return { ok: false, status: 400, code: validation.code, message: validation.message };

  const { startsAtLocal, startsAtUtc, durationMinutes: requestedDuration } = validation.value;
  const startsAtMs = startsAtUtc.getTime();
  const appointments = appointmentsRef(tenantId);
  const appointmentRef = appointments.doc(appointmentId);

  const outcome = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(appointmentRef);
    if (!snapshot.exists) return { kind: "missing" };

    const data = snapshot.data();
    if (data.status === "cancelled") return { kind: "cancelled" };

    const durationMinutes = requestedDuration
      ?? (Number.isInteger(data.durationMinutes) ? data.durationMinutes : 45);
    const endsAtUtc = new Date(startsAtMs + durationMinutes * 60 * 1000);
    const endsAtMs = endsAtUtc.getTime();

    // Mismo patrón que al crear, pero ignorando la propia cita.
    const window = await transaction.get(
      appointments
        .where("startsAt", ">=", Timestamp.fromMillis(startsAtMs - MAX_APPOINTMENT_DURATION_MS))
        .where("startsAt", "<", Timestamp.fromMillis(endsAtMs)),
    );
    const conflict = window.docs.some((doc) => {
      if (doc.id === appointmentId) return false;
      const other = doc.data();
      if (other.status !== "scheduled") return false;
      const otherStart = toMillis(other.startsAt);
      const otherEnd = toMillis(other.endsAt);
      if (otherStart === null || otherEnd === null) return false;
      return otherStart < endsAtMs && otherEnd > startsAtMs;
    });
    if (conflict) return { kind: "conflict" };

    transaction.update(appointmentRef, {
      startsAt: Timestamp.fromDate(startsAtUtc),
      endsAt: Timestamp.fromDate(endsAtUtc),
      startsAtLocal,
      durationMinutes,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(appointmentRef.collection("events").doc(), {
      type: "rescheduled",
      actorUid,
      at: FieldValue.serverTimestamp(),
      from: {
        startsAt: data.startsAt ?? null,
        startsAtLocal: data.startsAtLocal ?? null,
        durationMinutes: data.durationMinutes ?? null,
      },
      to: {
        startsAt: Timestamp.fromDate(startsAtUtc),
        startsAtLocal,
        durationMinutes,
      },
    });
    return {
      kind: "rescheduled",
      data: {
        ...data,
        startsAt: Timestamp.fromDate(startsAtUtc),
        endsAt: Timestamp.fromDate(endsAtUtc),
        startsAtLocal,
        durationMinutes,
      },
    };
  });

  if (outcome.kind === "missing") return appointmentNotFound();
  if (outcome.kind === "cancelled") {
    return {
      ok: false,
      status: 409,
      code: "appointment_cancelled",
      message: "No se puede reprogramar una cita cancelada.",
    };
  }
  if (outcome.kind === "conflict") {
    return {
      ok: false,
      status: 409,
      code: "appointment_conflict",
      message: "Ese horario se cruza con otra cita activa del negocio.",
    };
  }
  return { ok: true, appointment: serializeAppointment(appointmentId, outcome.data) };
}

function appointmentsRef(tenantId) {
  return db.collection("tenants").doc(tenantId).collection("appointments");
}

function appointmentNotFound() {
  return {
    ok: false,
    status: 404,
    code: "appointment_not_found",
    message: "No encontramos esa cita en el negocio.",
  };
}

export function serializeAppointment(appointmentId, data) {
  return {
    appointmentId,
    customerName: data?.customerName ?? null,
    customerPhone: data?.customerPhone ?? null,
    serviceName: data?.serviceName ?? null,
    startsAt: toIsoString(data?.startsAt),
    startsAtLocal: data?.startsAtLocal ?? null,
    durationMinutes: data?.durationMinutes ?? null,
    priceCOP: data?.priceCOP ?? null,
    status: data?.status ?? "scheduled",
    notes: data?.notes ?? "",
    createdAt: toIsoString(data?.createdAt),
  };
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

function toIsoString(value) {
  const millis = toMillis(value);
  return millis === null ? null : new Date(millis).toISOString();
}

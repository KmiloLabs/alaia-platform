// Rutas de agenda del negocio (corte "panel real con citas guardadas").
// El tenant SIEMPRE sale de la ruta ya validada por requireTenantMembership.

import { Router } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
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

export const appointmentRoutes = Router();
appointmentRoutes.use(requireUser);

appointmentRoutes.get("/tenants/:tenantId/appointments", requireTenantMembership, asyncRoute(async (req, res) => {
  const timeZone = resolveTenantTimeZone(req.tenant);
  const range = validateAppointmentRange(req.query, timeZone);
  if (!range.ok) return sendError(res, 400, range.code, range.message);

  const snapshot = await appointmentsRef(req.tenant.id)
    .where("startsAt", ">=", Timestamp.fromDate(range.value.start))
    .where("startsAt", "<", Timestamp.fromDate(range.value.end))
    .orderBy("startsAt", "asc")
    .get();

  return res.json({ appointments: snapshot.docs.map((doc) => serializeAppointment(doc.id, doc.data())) });
}));

// Horarios libres reales para el agente/panel: nunca inventa huecos ni ignora
// citas activas. El cálculo puro vive en availability.js.
appointmentRoutes.get("/tenants/:tenantId/availability", requireTenantMembership, asyncRoute(async (req, res) => {
  const timeZone = resolveTenantTimeZone(req.tenant);
  const openingHours = resolveOpeningHours(req.tenant);
  const defaultStepMinutes = resolveSlotStepMinutes(req.tenant);
  const validation = validateAvailabilityQuery(req.query, { defaultStepMinutes });
  if (!validation.ok) return sendError(res, 400, validation.code, validation.message);

  const { from, to, durationMinutes, stepMinutes } = validation.value;
  const range = localDateRangeToUtc(from, to, timeZone);
  const snapshot = await appointmentsRef(req.tenant.id)
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
    now: new Date(),
    busy,
  });

  return res.json({
    timeZone,
    durationMinutes,
    stepMinutes,
    slots: slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      startsAtLocal: slot.startsAtLocal,
    })),
  });
}));

appointmentRoutes.post("/tenants/:tenantId/appointments", requireTenantMembership, asyncRoute(async (req, res) => {
  const tenantId = req.tenant.id;
  const timeZone = resolveTenantTimeZone(req.tenant);
  const validation = validateAppointmentInput(req.body, timeZone);
  if (!validation.ok) return sendError(res, 400, validation.code, validation.message);

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
      createdBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(appointmentRef.collection("events").doc(), {
      type: "created",
      actorUid: req.user.uid,
      at: FieldValue.serverTimestamp(),
    });
    return { kind: "created" };
  });

  if (outcome.kind === "conflict") {
    return sendError(res, 409, "appointment_conflict", "Ese horario se cruza con otra cita activa del negocio.");
  }
  if (outcome.kind === "existing") {
    return res.status(200).json({ appointment: serializeAppointment(appointmentRef.id, outcome.snapshot.data()) });
  }

  // Releemos para devolver el createdAt resuelto por el servidor.
  const created = await appointmentRef.get();
  return res.status(201).json({ appointment: serializeAppointment(appointmentRef.id, created.data()) });
}));

appointmentRoutes.post(
  "/tenants/:tenantId/appointments/:appointmentId/cancel",
  requireTenantMembership,
  asyncRoute(async (req, res) => {
    const { appointmentId } = req.params;
    if (!APPOINTMENT_ID_PATTERN.test(appointmentId)) {
      return sendError(res, 404, "appointment_not_found", "No encontramos esa cita en el negocio.");
    }

    const appointmentRef = appointmentsRef(req.tenant.id).doc(appointmentId);
    const outcome = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(appointmentRef);
      if (!snapshot.exists) return { kind: "missing" };

      const data = snapshot.data();
      if (data.status === "cancelled") return { kind: "already_cancelled", data };

      transaction.update(appointmentRef, {
        status: "cancelled",
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: req.user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(appointmentRef.collection("events").doc(), {
        type: "cancelled",
        actorUid: req.user.uid,
        at: FieldValue.serverTimestamp(),
      });
      return { kind: "cancelled", data: { ...data, status: "cancelled" } };
    });

    if (outcome.kind === "missing") {
      return sendError(res, 404, "appointment_not_found", "No encontramos esa cita en el negocio.");
    }
    return res.json({ appointment: serializeAppointment(appointmentId, outcome.data) });
  }),
);

appointmentRoutes.post(
  "/tenants/:tenantId/appointments/:appointmentId/reschedule",
  requireTenantMembership,
  asyncRoute(async (req, res) => {
    const { appointmentId } = req.params;
    if (!APPOINTMENT_ID_PATTERN.test(appointmentId)) {
      return sendError(res, 404, "appointment_not_found", "No encontramos esa cita en el negocio.");
    }

    const timeZone = resolveTenantTimeZone(req.tenant);
    const validation = validateRescheduleInput(req.body, timeZone);
    if (!validation.ok) return sendError(res, 400, validation.code, validation.message);

    const { startsAtLocal, startsAtUtc, durationMinutes: requestedDuration } = validation.value;
    const startsAtMs = startsAtUtc.getTime();
    const appointments = appointmentsRef(req.tenant.id);
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
        actorUid: req.user.uid,
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

    if (outcome.kind === "missing") {
      return sendError(res, 404, "appointment_not_found", "No encontramos esa cita en el negocio.");
    }
    if (outcome.kind === "cancelled") {
      return sendError(res, 409, "appointment_cancelled", "No se puede reprogramar una cita cancelada.");
    }
    if (outcome.kind === "conflict") {
      return sendError(res, 409, "appointment_conflict", "Ese horario se cruza con otra cita activa del negocio.");
    }
    return res.json({ appointment: serializeAppointment(appointmentId, outcome.data) });
  }),
);

function appointmentsRef(tenantId) {
  return db.collection("tenants").doc(tenantId).collection("appointments");
}

function resolveTenantTimeZone(tenant) {
  const timeZone = tenant?.timeZone;
  return isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
}

function serializeAppointment(appointmentId, data) {
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

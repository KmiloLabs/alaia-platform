// Rutas de agenda del negocio (corte "panel real con citas guardadas").
// El tenant SIEMPRE sale de la ruta ya validada por requireTenantMembership.

import { Router } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import { isValidTimeZone } from "./timezone.js";
import {
  deriveAppointmentId,
  validateAppointmentInput,
  validateAppointmentRange,
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

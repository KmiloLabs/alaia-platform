// Rutas de agenda del negocio. La lógica de negocio vive en appointment-service.js
// y la comparten estas rutas y las herramientas del agente.

import { Router } from "express";
import { requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import {
  cancelAppointment,
  createAppointment,
  getAvailability,
  listAppointments,
  rescheduleAppointment,
  resolveTenantTimeZone,
} from "./appointment-service.js";

export const appointmentRoutes = Router();
appointmentRoutes.use(requireUser);

appointmentRoutes.get("/tenants/:tenantId/appointments", requireTenantMembership, asyncRoute(async (req, res) => {
  const result = await listAppointments({
    tenantId: req.tenant.id,
    timeZone: resolveTenantTimeZone(req.tenant),
    query: req.query,
  });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);
  return res.json({ appointments: result.appointments });
}));

appointmentRoutes.get("/tenants/:tenantId/availability", requireTenantMembership, asyncRoute(async (req, res) => {
  const result = await getAvailability({
    tenant: req.tenant,
    query: req.query,
    professionalId: typeof req.query?.professionalId === "string" ? req.query.professionalId : null,
  });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);
  return res.json({
    timeZone: result.timeZone,
    durationMinutes: result.durationMinutes,
    stepMinutes: result.stepMinutes,
    slots: result.slots,
  });
}));

appointmentRoutes.post("/tenants/:tenantId/appointments", requireTenantMembership, asyncRoute(async (req, res) => {
  const result = await createAppointment({
    tenantId: req.tenant.id,
    timeZone: resolveTenantTimeZone(req.tenant),
    actorUid: req.user.uid,
    body: req.body,
  });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);
  return res.status(result.created ? 201 : 200).json({ appointment: result.appointment });
}));

appointmentRoutes.post(
  "/tenants/:tenantId/appointments/:appointmentId/cancel",
  requireTenantMembership,
  asyncRoute(async (req, res) => {
    const result = await cancelAppointment({
      tenantId: req.tenant.id,
      actorUid: req.user.uid,
      appointmentId: req.params.appointmentId,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.json({ appointment: result.appointment });
  }),
);

appointmentRoutes.post(
  "/tenants/:tenantId/appointments/:appointmentId/reschedule",
  requireTenantMembership,
  asyncRoute(async (req, res) => {
    const result = await rescheduleAppointment({
      tenantId: req.tenant.id,
      timeZone: resolveTenantTimeZone(req.tenant),
      actorUid: req.user.uid,
      appointmentId: req.params.appointmentId,
      body: req.body,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.json({ appointment: result.appointment });
  }),
);

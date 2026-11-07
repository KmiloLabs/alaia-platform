// Rutas de recordatorios: ejecución protegida por secreto para el cron y
// resumen para el panel del negocio.

import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import { getReminderSummary, processDueReminders } from "./reminder-service.js";

export const reminderTaskRoutes = Router();

reminderTaskRoutes.post("/tasks/reminders/run", asyncRoute(async (req, res) => {
  const expected = typeof process.env.CRON_SECRET === "string" ? process.env.CRON_SECRET.trim() : "";
  if (expected === "") {
    return sendError(res, 503, "cron_disabled", "El disparador de recordatorios no está configurado.");
  }
  const provided = req.get("x-cron-secret");
  if (!safeEqual(provided, expected)) {
    return sendError(res, 401, "invalid_cron_secret", "El secreto del cron no es válido.");
  }

  const result = await processDueReminders();
  return res.json(result);
}));

export const reminderRoutes = Router();
reminderRoutes.use(requireUser);

reminderRoutes.get(
  "/tenants/:tenantId/reminders/summary",
  requireTenantMembership,
  asyncRoute(async (req, res) => {
    return res.json(await getReminderSummary({ tenantId: req.tenant.id }));
  }),
);

function safeEqual(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

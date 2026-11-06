// Rutas del panel de plataforma. Todas exigen token válido y que el correo
// figure en PLATFORM_ADMIN_EMAILS (si no está configurada, nadie es admin).

import { Router } from "express";
import { requirePlatformAdmin, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import {
  getPlatformSummary,
  getPlatformTenantDetail,
  listPlatformTenants,
  updatePlatformTenant,
} from "./platform-service.js";

export const platformRoutes = Router();
platformRoutes.use(requireUser);
platformRoutes.use(requirePlatformAdmin);

platformRoutes.get("/platform/summary", asyncRoute(async (_req, res) => {
  return res.json(await getPlatformSummary());
}));

platformRoutes.get("/platform/tenants", asyncRoute(async (req, res) => {
  const result = await listPlatformTenants({
    query: typeof req.query?.query === "string" ? req.query.query : "",
    status: typeof req.query?.status === "string" ? req.query.status : "",
  });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);
  return res.json({ tenants: result.tenants });
}));

platformRoutes.get("/platform/tenants/:tenantId", asyncRoute(async (req, res) => {
  const result = await getPlatformTenantDetail({ tenantId: req.params.tenantId });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);
  return res.json({ tenant: result.tenant });
}));

platformRoutes.patch("/platform/tenants/:tenantId", asyncRoute(async (req, res) => {
  const result = await updatePlatformTenant({
    tenantId: req.params.tenantId,
    body: req.body,
    actorUid: req.user.uid,
  });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);
  return res.json({ tenant: result.tenant });
}));

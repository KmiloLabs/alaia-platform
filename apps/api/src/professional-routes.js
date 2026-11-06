// Rutas de profesionales del negocio. Leer: cualquier miembro activo. Escribir:
// solo el dueño. Un profesional de otro negocio es 404.

import { Router } from "express";
import { requireOwner, requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import { isValidTimeZone, utcToLocalDate } from "./timezone.js";
import {
  createProfessional,
  deactivateProfessional,
  listProfessionals,
  updateProfessional,
} from "./professional-catalog.js";
import { professionalRepository } from "./professional-repository.js";

export const professionalRoutes = Router();
professionalRoutes.use(requireUser);

professionalRoutes.get("/tenants/:tenantId/professionals", requireTenantMembership, asyncRoute(async (req, res) => {
  const includeInactive = req.query?.includeInactive === "1" || req.query?.includeInactive === "true";
  const result = await listProfessionals({
    tenantId: req.tenant.id,
    includeInactive,
    repository: professionalRepository,
  });
  return res.json({ professionals: result.professionals, total: result.total });
}));

professionalRoutes.post(
  "/tenants/:tenantId/professionals",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const result = await createProfessional({
      tenantId: req.tenant.id,
      body: req.body,
      defaultEffectiveFrom: todayInTenant(req.tenant),
      repository: professionalRepository,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.status(201).json({ professional: result.professional });
  }),
);

professionalRoutes.patch(
  "/tenants/:tenantId/professionals/:professionalId",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const result = await updateProfessional({
      tenantId: req.tenant.id,
      professionalId: req.params.professionalId,
      body: req.body,
      defaultEffectiveFrom: todayInTenant(req.tenant),
      repository: professionalRepository,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.json({ professional: result.professional });
  }),
);

professionalRoutes.delete(
  "/tenants/:tenantId/professionals/:professionalId",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const result = await deactivateProfessional({
      tenantId: req.tenant.id,
      professionalId: req.params.professionalId,
      repository: professionalRepository,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.json({ professional: result.professional });
  }),
);

function todayInTenant(tenant) {
  const timeZone = isValidTimeZone(tenant?.timeZone) ? tenant.timeZone : "America/Bogota";
  return utcToLocalDate(new Date(), timeZone);
}

// Rutas del catálogo de servicios del negocio. Listar: cualquier miembro activo.
// Crear/editar/desactivar: solo el dueño. El tenant sale de la ruta validada.

import { Router } from "express";
import { requireOwner, requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import {
  createService,
  deactivateService,
  listServices,
  updateService,
} from "./service-catalog.js";
import { serviceRepository } from "./service-repository.js";

export const serviceRoutes = Router();
serviceRoutes.use(requireUser);

serviceRoutes.get("/tenants/:tenantId/services", requireTenantMembership, asyncRoute(async (req, res) => {
  const includeInactive = req.query?.includeInactive === "1" || req.query?.includeInactive === "true";
  const result = await listServices({
    tenantId: req.tenant.id,
    includeInactive,
    repository: serviceRepository,
  });
  return res.json({ services: result.services });
}));

serviceRoutes.post(
  "/tenants/:tenantId/services",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const result = await createService({
      tenantId: req.tenant.id,
      body: req.body,
      repository: serviceRepository,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.status(201).json({ service: result.service });
  }),
);

serviceRoutes.patch(
  "/tenants/:tenantId/services/:serviceId",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const result = await updateService({
      tenantId: req.tenant.id,
      serviceId: req.params.serviceId,
      body: req.body,
      repository: serviceRepository,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.json({ service: result.service });
  }),
);

serviceRoutes.delete(
  "/tenants/:tenantId/services/:serviceId",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const hard = req.query.hard === "1" || req.query.hard === "true";
    if (hard) {
      const existing = await serviceRepository.get(req.tenant.id, req.params.serviceId);
      if (!existing) {
        return sendError(res, 404, "service_not_found", "No encontramos ese servicio.");
      }
      await serviceRepository.delete(req.tenant.id, req.params.serviceId);
      return res.json({ deleted: true, serviceId: req.params.serviceId });
    }
    const result = await deactivateService({
      tenantId: req.tenant.id,
      serviceId: req.params.serviceId,
      repository: serviceRepository,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.json({ service: result.service });
  }),
);

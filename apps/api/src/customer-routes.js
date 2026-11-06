// Rutas de clientes del negocio. Leer: cualquier miembro activo. Escribir: solo
// el dueño. El tenant sale de la ruta validada; un cliente de otro negocio es 404.

import { Router } from "express";
import { db } from "./firebase.js";
import { requireOwner, requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import { serializeAppointment } from "./appointment-service.js";
import {
  createCustomer,
  deactivateCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "./customer-catalog.js";
import { customerRepository } from "./customer-repository.js";

const MAX_APPOINTMENTS_HISTORY = 50;

export const customerRoutes = Router();
customerRoutes.use(requireUser);

customerRoutes.get("/tenants/:tenantId/customers", requireTenantMembership, asyncRoute(async (req, res) => {
  const includeInactive = req.query?.includeInactive === "1" || req.query?.includeInactive === "true";
  const query = typeof req.query?.query === "string" ? req.query.query : null;
  const result = await listCustomers({
    tenantId: req.tenant.id,
    query,
    includeInactive,
    repository: customerRepository,
  });
  return res.json({ customers: result.customers, total: result.total });
}));

customerRoutes.get("/tenants/:tenantId/customers/:customerId", requireTenantMembership, asyncRoute(async (req, res) => {
  const customer = await getCustomer({
    tenantId: req.tenant.id,
    customerId: req.params.customerId,
    repository: customerRepository,
  });
  if (!customer) {
    return sendError(res, 404, "customer_not_found", "No encontramos ese cliente en el negocio.");
  }

  const snapshot = await db.collection("tenants").doc(req.tenant.id).collection("appointments")
    .where("customerId", "==", customer.customerId)
    .get();
  const appointments = snapshot.docs
    .map((doc) => serializeAppointment(doc.id, doc.data()))
    .sort((a, b) => (Date.parse(b.startsAt) || 0) - (Date.parse(a.startsAt) || 0))
    .slice(0, MAX_APPOINTMENTS_HISTORY);

  return res.json({ customer, appointments });
}));

customerRoutes.post(
  "/tenants/:tenantId/customers",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const result = await createCustomer({
      tenantId: req.tenant.id,
      body: req.body,
      repository: customerRepository,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.status(201).json({ customer: result.customer });
  }),
);

customerRoutes.patch(
  "/tenants/:tenantId/customers/:customerId",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const result = await updateCustomer({
      tenantId: req.tenant.id,
      customerId: req.params.customerId,
      body: req.body,
      repository: customerRepository,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.json({ customer: result.customer });
  }),
);

customerRoutes.delete(
  "/tenants/:tenantId/customers/:customerId",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const result = await deactivateCustomer({
      tenantId: req.tenant.id,
      customerId: req.params.customerId,
      repository: customerRepository,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);
    return res.json({ customer: result.customer });
  }),
);

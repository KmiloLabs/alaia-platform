// Rutas del agente configurable por negocio. Todas exigen Bearer y membresía
// activa; el tenant sale de la ruta y nunca del modelo ni del cuerpo.

import { Router } from "express";
import { requireTenantMembership, requireUser } from "../auth-middleware.js";
import { asyncRoute, sendError } from "../http.js";
import { getAgentConfigForTenant, saveAgentConfig, sendAgentMessage } from "./service.js";

export const agentRoutes = Router();
agentRoutes.use(requireUser);

agentRoutes.get("/tenants/:tenantId/agent/config", requireTenantMembership, asyncRoute(async (req, res) => {
  return res.json(await getAgentConfigForTenant(req.tenant));
}));

agentRoutes.put("/tenants/:tenantId/agent/config", requireTenantMembership, asyncRoute(async (req, res) => {
  const result = await saveAgentConfig({
    tenantId: req.tenant.id,
    actorUid: req.user.uid,
    body: req.body,
  });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);
  return res.json(await getAgentConfigForTenant({ ...req.tenant, agent: result.config }));
}));

agentRoutes.post("/tenants/:tenantId/agent/messages", requireTenantMembership, asyncRoute(async (req, res) => {
  const result = await sendAgentMessage({
    tenant: req.tenant,
    actorUid: req.user.uid,
    body: req.body,
  });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);
  return res.json({
    conversationId: result.conversationId,
    reply: result.reply,
    action: result.action,
    handoff: result.handoff,
    toolCalls: result.toolCalls,
    model: result.model,
  });
}));

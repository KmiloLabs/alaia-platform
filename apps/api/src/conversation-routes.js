// Conversaciones del negocio: lista, detalle, handoff humano-IA y respuesta
// humana por el mismo canal (sandbox registra en whatsappOutbox).

import { Router } from "express";
import { requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import {
  getConversation,
  getConversationDetail,
  listConversations,
  serializeConversationSummary,
  setHumanActive,
  appendConversationMessage,
} from "./conversation-service.js";
import { resolveWhatsappMode, sendWhatsappGraphMessage } from "./whatsapp.js";
import {
  whatsappNumberRepository,
  whatsappOutboxRepository,
} from "./whatsapp-repository.js";

const MAX_REPLY_LENGTH = 2000;
const CONVERSATION_STATUSES = new Set(["all", "human", "bot"]);

export const conversationRoutes = Router();
conversationRoutes.use(requireUser);

conversationRoutes.get("/tenants/:tenantId/conversations", requireTenantMembership, asyncRoute(async (req, res) => {
  const status = typeof req.query?.status === "string" ? req.query.status.trim().toLowerCase() : "all";
  if (!CONVERSATION_STATUSES.has(status)) {
    return sendError(res, 400, "invalid_status", "El estado debe ser all, human o bot.");
  }
  const parsedLimit = Number(req.query?.limit);
  const limit = Number.isInteger(parsedLimit) ? parsedLimit : 50;
  return res.json({
    conversations: await listConversations({ tenantId: req.tenant.id, status, limit }),
  });
}));

conversationRoutes.get(
  "/tenants/:tenantId/conversations/:conversationId",
  requireTenantMembership,
  asyncRoute(async (req, res) => {
    const detail = await getConversationDetail({
      tenantId: req.tenant.id,
      conversationId: req.params.conversationId,
    });
    if (!detail) return sendError(res, 404, "conversation_not_found", "No encontramos esa conversación.");
    return res.json(detail);
  }),
);

conversationRoutes.post(
  "/tenants/:tenantId/conversations/:conversationId/handoff",
  requireTenantMembership,
  asyncRoute(async (req, res) => {
    const conversation = await getConversation({
      tenantId: req.tenant.id,
      conversationId: req.params.conversationId,
    });
    if (!conversation) return sendError(res, 404, "conversation_not_found", "No encontramos esa conversación.");

    const active = req.body?.active;
    if (typeof active !== "boolean") {
      return sendError(res, 400, "invalid_active", "El campo active debe ser true o false.");
    }

    const now = new Date();
    await setHumanActive({
      conversationRef: conversation.ref,
      active,
      userId: req.user.uid,
      now,
    });
    return res.json({
      conversation: serializeConversationSummary(conversation.conversationId, {
        ...conversation.data,
        humanActive: active,
        humanActiveAt: now,
        humanActiveBy: req.user.uid,
      }),
    });
  }),
);

conversationRoutes.post(
  "/tenants/:tenantId/conversations/:conversationId/reply",
  requireTenantMembership,
  asyncRoute(async (req, res) => {
    const conversation = await getConversation({
      tenantId: req.tenant.id,
      conversationId: req.params.conversationId,
    });
    if (!conversation) return sendError(res, 404, "conversation_not_found", "No encontramos esa conversación.");
    if (conversation.data.humanActive !== true) {
      return sendError(res, 409, "human_not_active", "Activa la atención humana antes de responder.");
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (text.length < 1 || text.length > MAX_REPLY_LENGTH) {
      return sendError(res, 400, "invalid_message", "El mensaje debe tener entre 1 y 2000 caracteres.");
    }
    const to = typeof conversation.data.customerPhone === "string" ? conversation.data.customerPhone : "";
    if (to === "") {
      return sendError(res, 409, "conversation_without_phone", "La conversación no tiene teléfono de destino.");
    }

    const mode = resolveWhatsappMode(process.env);
    if (mode === "off") return sendError(res, 503, "whatsapp_disabled", "El canal de WhatsApp no está activo.");

    const now = new Date();
    let delivery;
    if (mode === "sandbox") {
      await whatsappOutboxRepository.record(req.tenant.id, {
        tenantId: req.tenant.id,
        source: "human_reply",
        to,
        text,
        conversationId: conversation.conversationId,
        authorUid: req.user.uid,
        mode,
        status: "recorded",
      });
      delivery = { ok: true };
    } else {
      const number = await whatsappNumberRepository.findActiveByTenant(req.tenant.id);
      if (!number) {
        return sendError(res, 409, "whatsapp_not_connected", "Conecta el número de WhatsApp antes de responder.");
      }
      delivery = await sendWhatsappGraphMessage({
        phoneNumberId: number.phoneNumberId,
        to,
        text,
        env: process.env,
      });
      await whatsappOutboxRepository.record(req.tenant.id, {
        tenantId: req.tenant.id,
        source: "human_reply",
        phoneNumberId: number.phoneNumberId,
        to,
        text,
        conversationId: conversation.conversationId,
        authorUid: req.user.uid,
        mode,
        status: delivery.ok ? "sent" : "failed",
        error: delivery.ok ? null : delivery.error ?? null,
      });
      if (!delivery.ok) {
        return sendError(res, 502, "whatsapp_send_failed", "No se pudo enviar la respuesta por WhatsApp.");
      }
    }

    const messageId = await appendConversationMessage({
      conversationRef: conversation.ref,
      role: "human",
      content: text,
      now,
    });

    return res.json({
      conversationId: conversation.conversationId,
      message: { messageId, role: "human", content: text, at: now.toISOString() },
    });
  }),
);

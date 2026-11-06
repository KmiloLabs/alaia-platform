// Rutas del canal de WhatsApp:
// - webhook público (GET verificación y POST firmado con cuerpo crudo),
// - estado y prueba del canal para el negocio,
// - conexión/desconexión del número desde el panel de plataforma.

import express, { Router } from "express";
import { db } from "./firebase.js";
import { asyncRoute, sendError } from "./http.js";
import {
  requireOwner,
  requirePlatformAdmin,
  requireTenantMembership,
  requireUser,
} from "./auth-middleware.js";
import {
  resolveWhatsappMode,
  verifyWhatsappChallenge,
  verifyWhatsappSignature,
} from "./whatsapp.js";
import { whatsappNumberRepository } from "./whatsapp-repository.js";
import { processWhatsappWebhook, runWhatsappTestPipeline } from "./whatsapp-service.js";

const MAX_TEST_MESSAGE_LENGTH = 2000;
const PHONE_NUMBER_ID_PATTERN = /^\d{1,40}$/;

// El cuerpo crudo debe leerse ANTES de express.json (se monta antes en server.js).
const rawJson = express.raw({ type: "application/json", limit: "256kb" });

export const whatsappWebhookRoutes = Router();

whatsappWebhookRoutes.get("/webhooks/whatsapp", (req, res) => {
  if (resolveWhatsappMode(process.env) === "off") {
    return sendError(res, 503, "whatsapp_disabled", "El canal de WhatsApp no está activo.");
  }

  const verification = verifyWhatsappChallenge({
    mode: req.query?.["hub.mode"],
    token: req.query?.["hub.verify_token"],
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    challenge: req.query?.["hub.challenge"],
  });
  if (!verification.ok) {
    return sendError(res, 403, "forbidden", "No se pudo verificar el webhook.");
  }
  return res.type("text/plain").send(verification.challenge);
});

whatsappWebhookRoutes.post("/webhooks/whatsapp", rawJson, asyncRoute(async (req, res) => {
  if (resolveWhatsappMode(process.env) === "off") {
    return sendError(res, 503, "whatsapp_disabled", "El canal de WhatsApp no está activo.");
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  const signature = req.get("x-hub-signature-256") ?? null;
  if (!verifyWhatsappSignature({
    rawBody,
    signature,
    appSecret: process.env.WHATSAPP_APP_SECRET,
  })) {
    return sendError(res, 401, "invalid_signature", "La firma del webhook no es válida.");
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return sendError(res, 400, "invalid_payload", "El cuerpo del webhook no es JSON válido.");
  }

  // Respondemos 200 de inmediato y procesamos después, sin bloquear a Meta.
  res.status(200).json({ received: true });
  setImmediate(() => {
    processWhatsappWebhook({ payload }).catch(() => {});
  });
}));

export const whatsappRoutes = Router();
whatsappRoutes.use(requireUser);

whatsappRoutes.get("/tenants/:tenantId/channel/whatsapp", requireTenantMembership, asyncRoute(async (req, res) => {
  const number = await whatsappNumberRepository.findActiveByTenant(req.tenant.id);
  return res.json({
    mode: resolveWhatsappMode(process.env),
    connected: Boolean(number),
    displayPhone: typeof number?.displayPhone === "string" ? number.displayPhone : null,
  });
}));

whatsappRoutes.post(
  "/tenants/:tenantId/channel/whatsapp/test",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 1 || text.length > MAX_TEST_MESSAGE_LENGTH) {
      return sendError(res, 400, "invalid_message", "El mensaje debe tener entre 1 y 2000 caracteres.");
    }
    if (resolveWhatsappMode(process.env) === "off") {
      return sendError(res, 503, "whatsapp_disabled", "El canal de WhatsApp no está activo.");
    }

    const result = await runWhatsappTestPipeline({
      tenant: req.tenant,
      actorUid: req.user.uid,
      text,
    });
    if (!result.ok) return sendError(res, result.status, result.code, result.message);

    return res.json({
      reply: result.reply,
      action: result.action,
      toolCalls: result.toolCalls,
      model: result.model,
      conversationId: result.conversationId,
    });
  }),
);

export const whatsappPlatformRoutes = Router();

whatsappPlatformRoutes.put(
  "/platform/tenants/:tenantId/whatsapp",
  requireUser,
  requirePlatformAdmin,
  asyncRoute(async (req, res) => {
  const tenantSnapshot = await db.collection("tenants").doc(req.params.tenantId).get();
  if (!tenantSnapshot.exists) {
    return sendError(res, 404, "tenant_not_found", "No encontramos ese negocio.");
  }

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const phoneNumberId = typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
  if (!PHONE_NUMBER_ID_PATTERN.test(phoneNumberId)) {
    return sendError(res, 400, "invalid_phone_number_id", "El phoneNumberId debe tener entre 1 y 40 dígitos.");
  }

  const existing = await whatsappNumberRepository.get(phoneNumberId);
  if (existing && existing.tenantId !== req.params.tenantId) {
    return sendError(res, 409, "phone_number_taken", "Ese número ya está conectado a otro negocio.");
  }

  const displayPhone = typeof body.displayPhone === "string" ? body.displayPhone.trim().slice(0, 40) : "";
  const wabaId = typeof body.wabaId === "string" && body.wabaId.trim() !== ""
    ? body.wabaId.trim().slice(0, 64)
    : existing?.wabaId ?? null;

  const saved = await whatsappNumberRepository.set(phoneNumberId, {
    phoneNumberId,
    tenantId: req.params.tenantId,
    displayPhone,
    wabaId,
    status: "active",
    connectedAt: new Date(),
  });

  return res.json({
    whatsapp: {
      phoneNumberId: saved.phoneNumberId,
      tenantId: saved.tenantId,
      displayPhone: saved.displayPhone ?? "",
      status: saved.status,
    },
  });
}));

whatsappPlatformRoutes.delete(
  "/platform/tenants/:tenantId/whatsapp",
  requireUser,
  requirePlatformAdmin,
  asyncRoute(async (req, res) => {
    const numbers = await whatsappNumberRepository.listByTenant(req.params.tenantId);
    for (const number of numbers) {
      await whatsappNumberRepository.delete(number.phoneNumberId);
    }
    return res.json({ disconnected: true, removed: numbers.length });
  }),
);

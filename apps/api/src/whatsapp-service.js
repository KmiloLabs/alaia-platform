// Procesamiento de mensajes entrantes de WhatsApp con el mismo pipeline del
// agente. En sandbox no se llama a Meta: la respuesta se registra en la bandeja
// de salida del negocio.

import { db } from "./firebase.js";
import {
  normalizeWhatsappPayload,
  resolveWhatsappMode,
  sendWhatsappGraphMessage,
} from "./whatsapp.js";
import {
  whatsappMessageRepository,
  whatsappNumberRepository,
  whatsappOutboxRepository,
} from "./whatsapp-repository.js";
import { findCustomerByPhone, createCustomer } from "./customer-catalog.js";
import { customerRepository } from "./customer-repository.js";
import { sendAgentMessage } from "./agent/service.js";
import {
  renderPrivacyNotice,
  resolveAssistant,
  resolveConversationAutomation,
  shouldSendPrivacyNotice,
} from "./assistant.js";
import {
  appendConversationMessage,
  countConversationMessages,
  ensureWhatsappConversation,
  markPrivacyNoticeSent,
  setHumanActive,
} from "./conversation-service.js";

const MAX_AGENT_MESSAGE_LENGTH = 2000;
const TEST_CUSTOMER_PHONE = "3000000000";
const TEST_CUSTOMER_NAME = "Cliente de prueba WhatsApp";

export async function processWhatsappWebhook({ payload, env = process.env, fetchImpl = fetch } = {}) {
  const messages = normalizeWhatsappPayload(payload);
  const results = [];
  for (const message of messages) {
    try {
      results.push(await processWhatsappMessage({ message, env, fetchImpl }));
    } catch (error) {
      results.push({ status: "error", messageId: message.messageId, error: String(error?.message ?? error) });
    }
  }
  return { processed: results.length, results };
}

export async function processWhatsappMessage({ message, env = process.env, fetchImpl = fetch } = {}) {
  if (!message || typeof message.messageId !== "string" || message.messageId === "") {
    return { status: "ignored" };
  }

  // Dedupe por message.id en transacción: el segundo intento no reprocesa.
  const claimed = await whatsappMessageRepository.claim(message.messageId, {
    waMessageId: message.messageId,
    phoneNumberId: message.phoneNumberId ?? null,
    from: message.from ?? null,
    receivedAt: new Date(),
  });
  if (!claimed) return { status: "duplicate" };

  const number = message.phoneNumberId ? await whatsappNumberRepository.get(message.phoneNumberId) : null;
  if (!number || number.status !== "active" || typeof number.tenantId !== "string" || number.tenantId === "") {
    await whatsappMessageRepository.update(message.messageId, { status: "unmapped" });
    return { status: "unmapped" };
  }

  const tenantSnapshot = await db.collection("tenants").doc(number.tenantId).get();
  if (!tenantSnapshot.exists) {
    await whatsappMessageRepository.update(message.messageId, { status: "tenant_not_found", tenantId: number.tenantId });
    return { status: "tenant_not_found" };
  }
  const tenant = { id: number.tenantId, ...tenantSnapshot.data() };

  const customer = await findOrCreateCustomer({ tenantId: tenant.id, message });
  const now = new Date();
  const conversation = await ensureWhatsappConversation({
    tenantId: tenant.id,
    customerPhone: message.from,
    customerName: customer.name ?? message.profileName,
    customerId: customer.customerId,
    now,
  });
  let conversationData = conversation.data;

  // Coexistencia humano-IA: humano activo bloquea al agente; >12 h se reanuda.
  const automation = resolveConversationAutomation({ conversation: conversationData, now });
  if (automation.autoResumed) {
    await setHumanActive({ conversationRef: conversation.ref, active: false, userId: null, now });
    conversationData = { ...conversationData, humanActive: false, humanActiveAt: null, humanActiveBy: null };
  }

  const text = String(message.text ?? "").slice(0, MAX_AGENT_MESSAGE_LENGTH);
  const mode = resolveWhatsappMode(env);

  // Humano a cargo: solo se guarda el historial; la IA no responde.
  if (automation.humanActive) {
    await appendConversationMessage({
      conversationRef: conversation.ref,
      role: "user",
      content: text,
      now,
    });
    await whatsappOutboxRepository.record(tenant.id, {
      tenantId: tenant.id,
      source: "whatsapp_inbound",
      phoneNumberId: message.phoneNumberId,
      to: message.from,
      text,
      conversationId: conversation.conversationId,
      customerId: customer.customerId,
      mode,
      status: "skipped",
      reason: "human_active",
    });
    await whatsappMessageRepository.update(message.messageId, {
      status: "processed",
      tenantId: tenant.id,
      conversationId: conversation.conversationId,
      customerId: customer.customerId,
      mode: "human_active",
    });
    return { status: "human_active", conversationId: conversation.conversationId };
  }

  // Aviso de privacidad: una sola vez y solo en la primera conversación nueva.
  const messagesCount = await countConversationMessages(conversation.ref);
  if (shouldSendPrivacyNotice({ conversation: conversationData, messagesCount })) {
    const noticeText = renderPrivacyNotice(resolveAssistant(tenant).privacyNotice, tenant.name);
    const delivered = await deliverNotice({
      tenant,
      mode,
      phoneNumberId: message.phoneNumberId,
      to: message.from,
      text: noticeText,
      conversationId: conversation.conversationId,
      env,
      fetchImpl,
    });
    if (delivered) {
      await appendConversationMessage({
        conversationRef: conversation.ref,
        role: "assistant",
        content: noticeText,
        now,
        kind: "privacy_notice",
      });
      await markPrivacyNoticeSent({ conversationRef: conversation.ref, now });
    }
  }

  const agentResult = await sendAgentMessage({
    tenant,
    actorUid: null,
    channel: "whatsapp",
    customerPhone: message.from,
    customerId: customer.customerId,
    body: { message: text, conversationId: conversation.conversationId },
  });

  if (!agentResult.ok) {
    await whatsappMessageRepository.update(message.messageId, {
      status: "agent_error",
      tenantId: tenant.id,
      errorCode: agentResult.code ?? null,
    });
    return { status: "agent_error", code: agentResult.code ?? null };
  }

  const baseRecord = {
    tenantId: tenant.id,
    source: "whatsapp_agent",
    phoneNumberId: message.phoneNumberId,
    to: message.from,
    text: agentResult.reply,
    conversationId: agentResult.conversationId,
    customerId: customer.customerId,
    mode,
  };

  if (mode === "sandbox") {
    await whatsappOutboxRepository.record(tenant.id, { ...baseRecord, status: "recorded" });
    await whatsappMessageRepository.update(message.messageId, {
      status: "processed",
      tenantId: tenant.id,
      conversationId: agentResult.conversationId,
      customerId: customer.customerId,
      mode,
    });
    return {
      status: "sandboxed",
      conversationId: agentResult.conversationId,
      reply: agentResult.reply,
    };
  }

  if (mode === "live") {
    const delivery = await sendWhatsappGraphMessage({
      phoneNumberId: message.phoneNumberId,
      to: message.from,
      text: agentResult.reply,
      env,
      fetchImpl,
    });
    await whatsappOutboxRepository.record(tenant.id, {
      ...baseRecord,
      status: delivery.ok ? "sent" : "failed",
      error: delivery.ok ? null : delivery.error ?? null,
    });
    await whatsappMessageRepository.update(message.messageId, {
      status: delivery.ok ? "sent" : "send_failed",
      tenantId: tenant.id,
      conversationId: agentResult.conversationId,
      customerId: customer.customerId,
      mode,
    });
    return {
      status: delivery.ok ? "sent" : "send_failed",
      conversationId: agentResult.conversationId,
      reply: agentResult.reply,
    };
  }

  await whatsappMessageRepository.update(message.messageId, {
    status: "disabled",
    tenantId: tenant.id,
    conversationId: agentResult.conversationId,
  });
  return { status: "disabled", conversationId: agentResult.conversationId };
}

// Entrega el aviso de privacidad por el mismo canal. sandbox -> outbox.
async function deliverNotice({ tenant, mode, phoneNumberId, to, text, conversationId, env, fetchImpl }) {
  if (mode === "sandbox") {
    await whatsappOutboxRepository.record(tenant.id, {
      tenantId: tenant.id,
      source: "privacy_notice",
      phoneNumberId,
      to,
      text,
      conversationId,
      mode,
      status: "recorded",
    });
    return true;
  }
  if (mode !== "live") return false;

  const number = await whatsappNumberRepository.findActiveByTenant(tenant.id);
  if (!number) return false;
  const delivery = await sendWhatsappGraphMessage({
    phoneNumberId: number.phoneNumberId,
    to,
    text,
    env,
    fetchImpl,
  });
  await whatsappOutboxRepository.record(tenant.id, {
    tenantId: tenant.id,
    source: "privacy_notice",
    phoneNumberId: number.phoneNumberId,
    to,
    text,
    conversationId,
    mode,
    status: delivery.ok ? "sent" : "failed",
    error: delivery.ok ? null : delivery.error ?? null,
  });
  return delivery.ok;
}

// Mismo pipeline del canal de prueba: cliente de prueba + agente + conversación
// whatsapp, sin enviar nada por Meta.
export async function runWhatsappTestPipeline({ tenant, actorUid = null, text }) {
  const customer = await findOrCreateTestCustomer({ tenantId: tenant.id });
  return sendAgentMessage({
    tenant,
    actorUid,
    channel: "whatsapp",
    customerPhone: TEST_CUSTOMER_PHONE,
    customerId: customer.customerId,
    body: { message: text },
  });
}

async function findOrCreateCustomer({ tenantId, message }) {
  const phone = typeof message.from === "string" ? message.from : "";
  const existing = await findCustomerByPhone({ tenantId, phone, repository: customerRepository });
  if (existing) return existing;

  const name = sanitizeCustomerName(message.profileName);
  const created = await createCustomer({
    tenantId,
    body: { name, phone },
    repository: customerRepository,
  });
  if (created.ok) return created.customer;
  return { customerId: null, name, phone };
}

async function findOrCreateTestCustomer({ tenantId }) {
  const existing = await findCustomerByPhone({
    tenantId,
    phone: TEST_CUSTOMER_PHONE,
    repository: customerRepository,
  });
  if (existing) return existing;

  const created = await createCustomer({
    tenantId,
    body: { name: TEST_CUSTOMER_NAME, phone: TEST_CUSTOMER_PHONE },
    repository: customerRepository,
  });
  if (created.ok) return created.customer;
  return { customerId: null, name: TEST_CUSTOMER_NAME, phone: TEST_CUSTOMER_PHONE };
}

function sanitizeCustomerName(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length < 2 || trimmed.length > 80) return "Cliente WhatsApp";
  return trimmed;
}

export { TEST_CUSTOMER_PHONE, TEST_CUSTOMER_NAME };

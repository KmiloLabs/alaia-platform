// Conversaciones del agente y del canal WhatsApp: búsqueda por teléfono, campos
// de coexistencia humano-IA, aviso de privacidad, mensajes y listados.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { toMillis } from "./assistant.js";

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;
const MAX_DETAIL_MESSAGES = 100;
const PREVIEW_LENGTH = 120;

function conversationsRef(tenantId) {
  return db.collection("tenants").doc(tenantId).collection("agentConversations");
}

export function conversationMatchesStatus(conversation, status = "all") {
  if (status === "human") return conversation?.humanActive === true;
  if (status === "bot") return conversation?.humanActive !== true;
  return true;
}

export async function getConversation({ tenantId, conversationId }) {
  if (typeof conversationId !== "string" || conversationId === "") return null;
  const ref = conversationsRef(tenantId).doc(conversationId);
  const snapshot = await ref.get();
  return snapshot.exists ? { ref, conversationId: snapshot.id, data: snapshot.data() } : null;
}

// Conversación de WhatsApp más reciente del teléfono (el teléfono nunca elige
// negocio: viene del mapeo phoneNumberId → tenantId).
export async function findWhatsappConversation({ tenantId, customerPhone }) {
  if (typeof customerPhone !== "string" || customerPhone === "") return null;
  const snapshot = await conversationsRef(tenantId)
    .where("customerPhone", "==", customerPhone)
    .limit(25)
    .get();
  let latest = null;
  let latestMs = -1;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.channel !== "whatsapp") continue;
    const millis = toMillis(data.updatedAt) ?? toMillis(data.startedAt) ?? 0;
    if (millis > latestMs) {
      latestMs = millis;
      latest = { ref: doc.ref, conversationId: doc.id, data };
    }
  }
  return latest;
}

export async function ensureWhatsappConversation({ tenantId, customerPhone, customerName = null, customerId = null, now = new Date() }) {
  const existing = await findWhatsappConversation({ tenantId, customerPhone });
  if (existing) return { ...existing, created: false };

  const ref = conversationsRef(tenantId).doc();
  const data = {
    channel: "whatsapp",
    customerPhone,
    customerName: typeof customerName === "string" ? customerName : null,
    customerId: customerId ?? null,
    humanActive: false,
    humanActiveAt: null,
    humanActiveBy: null,
    privacyNoticeSentAt: null,
    handoff: false,
    startedAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    lastMessageAt: null,
    lastMessagePreview: "",
  };
  await ref.set(data);
  return { ref, conversationId: ref.id, data, created: true };
}

export async function appendConversationMessage({
  conversationRef,
  role,
  content,
  now = new Date(),
  kind = null,
  toolCalls = undefined,
}) {
  const message = {
    role,
    content,
    at: Timestamp.fromDate(now),
  };
  if (kind !== null) message.kind = kind;
  if (Array.isArray(toolCalls)) message.toolCalls = toolCalls;
  const messageRef = await conversationRef.collection("messages").add(message);
  await conversationRef.set({
    lastMessageAt: Timestamp.fromDate(now),
    lastMessagePreview: buildPreview(content),
    updatedAt: Timestamp.fromDate(now),
  }, { merge: true });
  return messageRef.id;
}

export async function markPrivacyNoticeSent({ conversationRef, now = new Date() }) {
  await conversationRef.set({
    privacyNoticeSentAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  }, { merge: true });
}

export async function setHumanActive({ conversationRef, active, userId, now = new Date() }) {
  await conversationRef.set({
    humanActive: active === true,
    humanActiveAt: Timestamp.fromDate(now),
    humanActiveBy: userId ?? null,
    updatedAt: Timestamp.fromDate(now),
  }, { merge: true });
}

export async function countConversationMessages(conversationRef) {
  const snapshot = await conversationRef.collection("messages").limit(1).get();
  return snapshot.size;
}

export async function listConversations({ tenantId, status = "all", limit = DEFAULT_LIST_LIMIT }) {
  const snapshot = await conversationsRef(tenantId).get();
  const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), MAX_LIST_LIMIT) : DEFAULT_LIST_LIMIT;
  return snapshot.docs
    .map((doc) => ({ conversationId: doc.id, data: doc.data() }))
    .filter((item) => conversationMatchesStatus(item.data, status))
    .sort((a, b) => {
      const aMs = toMillis(a.data.lastMessageAt) ?? toMillis(a.data.updatedAt) ?? 0;
      const bMs = toMillis(b.data.lastMessageAt) ?? toMillis(b.data.updatedAt) ?? 0;
      return bMs - aMs;
    })
    .slice(0, safeLimit)
    .map((item) => serializeConversationSummary(item.conversationId, item.data));
}

export async function getConversationDetail({ tenantId, conversationId }) {
  const current = await getConversation({ tenantId, conversationId });
  if (!current) return null;

  const messagesSnapshot = await current.ref.collection("messages")
    .orderBy("at", "asc")
    .limit(MAX_DETAIL_MESSAGES)
    .get();
  return {
    conversation: serializeConversationSummary(current.conversationId, current.data),
    messages: messagesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        messageId: doc.id,
        role: data.role ?? "user",
        content: typeof data.content === "string" ? data.content : "",
        at: toIsoString(data.at),
        ...(typeof data.kind === "string" ? { kind: data.kind } : {}),
      };
    }),
  };
}

export function serializeConversationSummary(conversationId, data) {
  return {
    conversationId,
    channel: typeof data?.channel === "string" ? data.channel : "panel",
    customerPhone: typeof data?.customerPhone === "string" ? data.customerPhone : null,
    customerName: typeof data?.customerName === "string" ? data.customerName : null,
    humanActive: data?.humanActive === true,
    humanActiveAt: toIsoString(data?.humanActiveAt),
    humanActiveBy: typeof data?.humanActiveBy === "string" ? data.humanActiveBy : null,
    privacyNoticeSentAt: toIsoString(data?.privacyNoticeSentAt),
    lastMessageAt: toIsoString(data?.lastMessageAt),
    lastMessagePreview: typeof data?.lastMessagePreview === "string" ? data.lastMessagePreview : "",
  };
}

export function buildPreview(content) {
  const text = typeof content === "string" ? content.trim().replace(/\s+/g, " ") : "";
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
}

function toIsoString(value) {
  const millis = toMillis(value);
  return millis === null ? null : new Date(millis).toISOString();
}

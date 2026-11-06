// Canal oficial de WhatsApp: modo de prueba, firma del webhook, normalización de
// payload y envío por Graph API. Lógica pura y comprobable con dobles.

import { createHmac, timingSafeEqual } from "node:crypto";

export const WHATSAPP_MODES = Object.freeze(["off", "sandbox", "live"]);
export const DEFAULT_GRAPH_URL = "https://graph.facebook.com";
export const DEFAULT_API_VERSION = "v23.0";

export function resolveWhatsappMode(env = process.env) {
  const value = typeof env?.WHATSAPP_MODE === "string" ? env.WHATSAPP_MODE.trim().toLowerCase() : "";
  return WHATSAPP_MODES.includes(value) ? value : "off";
}

export function resolveWhatsappApiVersion(env = process.env) {
  const value = typeof env?.WHATSAPP_API_VERSION === "string" ? env.WHATSAPP_API_VERSION.trim() : "";
  return /^v\d+\.\d+$/.test(value) ? value : DEFAULT_API_VERSION;
}

export function resolveWhatsappGraphUrl(env = process.env) {
  const value = typeof env?.WHATSAPP_GRAPH_URL === "string" && env.WHATSAPP_GRAPH_URL.trim() !== ""
    ? env.WHATSAPP_GRAPH_URL.trim()
    : DEFAULT_GRAPH_URL;
  return value.replace(/\/+$/, "");
}

// GET del webhook: hub.mode=subscribe y el verify token deben coincidir.
export function verifyWhatsappChallenge({ mode, token, verifyToken, challenge } = {}) {
  if (mode !== "subscribe") return { ok: false };
  if (typeof verifyToken !== "string" || verifyToken === "") return { ok: false };
  if (typeof token !== "string" || token !== verifyToken) return { ok: false };
  return { ok: true, challenge: typeof challenge === "string" ? challenge : String(challenge ?? "") };
}

export function computeWhatsappSignature(rawBody, appSecret) {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ""), "utf8");
  return `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
}

// Comparación en tiempo constante sobre el HMAC-SHA256 del cuerpo CRUDO.
export function verifyWhatsappSignature({ rawBody, signature, appSecret } = {}) {
  if (typeof appSecret !== "string" || appSecret === "") return false;
  if (typeof signature !== "string") return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signature.trim());
  if (!match) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ""), "utf8");
  const expected = createHmac("sha256", appSecret).update(body).digest();
  const provided = Buffer.from(match[1], "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(expected, provided);
}

// Extrae solo mensajes de texto entrantes; ignora statuses, audio, imágenes, etc.
export function normalizeWhatsappPayload(payload) {
  if (!payload || typeof payload !== "object") return [];
  const normalized = [];

  for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value;
      if (!value || typeof value !== "object") continue;
      const phoneNumberId = typeof value.metadata?.phone_number_id === "string" ? value.metadata.phone_number_id : null;
      const wabaId = typeof entry?.id === "string" ? entry.id : null;
      const profileName = typeof value.contacts?.[0]?.profile?.name === "string" ? value.contacts[0].profile.name : null;

      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        if (message?.type !== "text") continue;
        const text = typeof message?.text?.body === "string" ? message.text.body : "";
        if (text.trim() === "") continue;
        if (typeof message?.id !== "string" || message.id === "") continue;
        if (typeof message?.from !== "string" || message.from === "") continue;
        normalized.push({
          messageId: message.id,
          from: message.from,
          text,
          phoneNumberId,
          wabaId,
          profileName,
          timestamp: typeof message.timestamp === "string" ? message.timestamp : null,
        });
      }
    }
  }

  return normalized;
}

export function buildGraphMessagePayload({ to, text }) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
}

// Envío real por Graph API. En sandbox no se llama: la respuesta va a la bandeja.
export async function sendWhatsappGraphMessage({ phoneNumberId, to, text, env = process.env, fetchImpl = fetch } = {}) {
  const token = typeof env?.WHATSAPP_TOKEN === "string" ? env.WHATSAPP_TOKEN.trim() : "";
  if (token === "") return { ok: false, error: "missing_token" };

  const url = `${resolveWhatsappGraphUrl(env)}/${resolveWhatsappApiVersion(env)}/${encodeURIComponent(phoneNumberId)}/messages`;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildGraphMessagePayload({ to, text })),
    });
    if (!response?.ok) {
      let detail = "";
      try {
        detail = String(await response.text()).slice(0, 300);
      } catch {
        detail = "";
      }
      return { ok: false, status: response?.status ?? null, error: detail || "graph_error" };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

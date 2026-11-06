import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_API_VERSION,
  DEFAULT_GRAPH_URL,
  buildGraphMessagePayload,
  computeWhatsappSignature,
  normalizeWhatsappPayload,
  resolveWhatsappApiVersion,
  resolveWhatsappGraphUrl,
  resolveWhatsappMode,
  sendWhatsappGraphMessage,
  verifyWhatsappChallenge,
  verifyWhatsappSignature,
} from "../src/whatsapp.js";

const SECRET = "alaia-app-secret-local";
const RAW = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));

test("firma HMAC válida e inválida sobre el cuerpo crudo", () => {
  const signature = computeWhatsappSignature(RAW, SECRET);
  assert.match(signature, /^sha256=[a-f0-9]{64}$/);
  assert.equal(verifyWhatsappSignature({ rawBody: RAW, signature, appSecret: SECRET }), true);

  assert.equal(verifyWhatsappSignature({ rawBody: RAW, signature: signature.toUpperCase(), appSecret: SECRET }), true);
  assert.equal(verifyWhatsappSignature({ rawBody: Buffer.from(RAW.toString().replace("[]", "[ ]")), signature, appSecret: SECRET }), false);
  assert.equal(verifyWhatsappSignature({ rawBody: RAW, signature, appSecret: "otro-secreto" }), false);
  assert.equal(verifyWhatsappSignature({ rawBody: RAW, signature: "sha256=deadbeef", appSecret: SECRET }), false);
  assert.equal(verifyWhatsappSignature({ rawBody: RAW, signature: null, appSecret: SECRET }), false);
  assert.equal(verifyWhatsappSignature({ rawBody: RAW, signature, appSecret: "" }), false);
});

test("verificación GET del webhook (hub.mode y verify token)", () => {
  assert.deepEqual(
    verifyWhatsappChallenge({ mode: "subscribe", token: "alaia-verify-token", verifyToken: "alaia-verify-token", challenge: "abc123" }),
    { ok: true, challenge: "abc123" },
  );
  assert.equal(verifyWhatsappChallenge({ mode: "subscribe", token: "otro", verifyToken: "alaia-verify-token", challenge: "abc123" }).ok, false);
  assert.equal(verifyWhatsappChallenge({ mode: "otro", token: "alaia-verify-token", verifyToken: "alaia-verify-token" }).ok, false);
  assert.equal(verifyWhatsappChallenge({ mode: "subscribe", token: "alaia-verify-token", verifyToken: "" }).ok, false);
});

test("modos y configuración de Graph API", () => {
  assert.equal(resolveWhatsappMode({}), "off");
  assert.equal(resolveWhatsappMode({ WHATSAPP_MODE: "sandbox" }), "sandbox");
  assert.equal(resolveWhatsappMode({ WHATSAPP_MODE: " LIVE " }), "live");
  assert.equal(resolveWhatsappMode({ WHATSAPP_MODE: "inventado" }), "off");

  assert.equal(resolveWhatsappApiVersion({}), DEFAULT_API_VERSION);
  assert.equal(resolveWhatsappApiVersion({ WHATSAPP_API_VERSION: "v24.0" }), "v24.0");
  assert.equal(resolveWhatsappApiVersion({ WHATSAPP_API_VERSION: "24" }), DEFAULT_API_VERSION);
  assert.equal(resolveWhatsappGraphUrl({}), DEFAULT_GRAPH_URL);
  assert.equal(resolveWhatsappGraphUrl({ WHATSAPP_GRAPH_URL: "https://graph.example.com/" }), "https://graph.example.com");
});

test("normaliza solo mensajes de texto entrantes", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      id: "waba-1",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "573001112222", phone_number_id: "123456" },
          contacts: [{ profile: { name: "Camila Rojas" }, wa_id: "573001234567" }],
          messages: [
            { id: "wamid.1", from: "573001234567", timestamp: "1700000000", type: "text", text: { body: "  Hola, quiero una cita  " } },
            { id: "wamid.2", from: "573001234567", type: "image", image: { id: "img" } },
            { id: "wamid.3", from: "573001234567", type: "text", text: { body: "   " } },
            { from: "573001234567", type: "text", text: { body: "sin id" } },
          ],
          statuses: [{ id: "wamid.9", status: "read" }],
        },
      }],
    }],
  };

  const messages = normalizeWhatsappPayload(payload);
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0], {
    messageId: "wamid.1",
    from: "573001234567",
    text: "  Hola, quiero una cita  ",
    phoneNumberId: "123456",
    wabaId: "waba-1",
    profileName: "Camila Rojas",
    timestamp: "1700000000",
  });

  assert.deepEqual(normalizeWhatsappPayload({}), []);
  assert.deepEqual(normalizeWhatsappPayload(null), []);
  assert.deepEqual(normalizeWhatsappPayload({ entry: [{ changes: [{ value: { statuses: [{ id: "x" }] } }] }] }), []);
});

test("payload de envío por Graph API", () => {
  assert.deepEqual(buildGraphMessagePayload({ to: "573001234567", text: "Hola" }), {
    messaging_product: "whatsapp",
    to: "573001234567",
    type: "text",
    text: { body: "Hola" },
  });
});

test("envío Graph API en vivo con fetch inyectado", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, async text() { return "{}"; } };
  };

  const result = await sendWhatsappGraphMessage({
    phoneNumberId: "123456",
    to: "573001234567",
    text: "Hola",
    env: { WHATSAPP_TOKEN: "token-1", WHATSAPP_API_VERSION: "v23.0", WHATSAPP_GRAPH_URL: "https://graph.facebook.com" },
    fetchImpl,
  });
  assert.deepEqual(result, { ok: true, status: 200 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://graph.facebook.com/v23.0/123456/messages");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.authorization, "Bearer token-1");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    messaging_product: "whatsapp",
    to: "573001234567",
    type: "text",
    text: { body: "Hola" },
  });
});

test("envío Graph API: sin token no llama a Meta y los errores se registran", async () => {
  let called = 0;
  const missingToken = await sendWhatsappGraphMessage({
    phoneNumberId: "123456",
    to: "573001234567",
    text: "Hola",
    env: {},
    fetchImpl: async () => { called += 1; return { ok: true, status: 200 }; },
  });
  assert.deepEqual(missingToken, { ok: false, error: "missing_token" });
  assert.equal(called, 0);

  const failed = await sendWhatsappGraphMessage({
    phoneNumberId: "123456",
    to: "573001234567",
    text: "Hola",
    env: { WHATSAPP_TOKEN: "token-1" },
    fetchImpl: async () => ({ ok: false, status: 400, async text() { return '{"error":"bad"}'; } }),
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.status, 400);
  assert.match(failed.error, /bad/);
});

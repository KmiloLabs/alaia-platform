import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PRIVACY_NOTICE,
  HUMAN_AUTO_RESUME_HOURS,
  MAX_PRIVACY_NOTICE_LENGTH,
  renderPrivacyNotice,
  resolveAssistant,
  resolveConversationAutomation,
  shouldAutoResumeHuman,
  shouldSendPrivacyNotice,
  validateAssistant,
} from "../src/assistant.js";

const NOW = new Date("2026-11-10T17:00:00.000Z");
const HOURS = 60 * 60 * 1000;

test("aviso de privacidad por defecto e interpolación de {negocio}", () => {
  assert.match(DEFAULT_PRIVACY_NOTICE, /inteligencia artificial de \{negocio\}/);
  assert.equal(
    renderPrivacyNotice(DEFAULT_PRIVACY_NOTICE, "Araan Barbería"),
    "Este chat lo atiende un asistente de inteligencia artificial de Araan Barbería. Tus datos se usan solo para gestionar tu cita. Si prefieres hablar con una persona, escribe PERSONA.",
  );
  assert.equal(renderPrivacyNotice("{negocio} atiende.", "Barbería"), "Barbería atiende.");
  assert.equal(HUMAN_AUTO_RESUME_HOURS, 12);
});

test("assistant.privacyNotice: default si no existe y tolerante al leer", () => {
  assert.deepEqual(resolveAssistant({}), { privacyNotice: DEFAULT_PRIVACY_NOTICE });
  assert.deepEqual(resolveAssistant({ assistant: { privacyNotice: "Nuestro aviso." } }), { privacyNotice: "Nuestro aviso." });
  assert.deepEqual(resolveAssistant({ assistant: { privacyNotice: "" } }), { privacyNotice: DEFAULT_PRIVACY_NOTICE });
  assert.deepEqual(resolveAssistant({ assistant: { privacyNotice: "x".repeat(MAX_PRIVACY_NOTICE_LENGTH + 1) } }), {
    privacyNotice: DEFAULT_PRIVACY_NOTICE,
  });
});

test("valida assistant.privacyNotice", () => {
  const valid = validateAssistant({ assistant: { privacyNotice: "Aviso personalizado {negocio}." } });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, { privacyNotice: "Aviso personalizado {negocio}." });

  assert.deepEqual(validateAssistant({ assistant: {} }), { ok: true, value: {} });

  const cases = [
    { assistant: "no-es-objeto" },
    { assistant: { privacyNotice: "" } },
    { assistant: { privacyNotice: "   " } },
    { assistant: { privacyNotice: 42 } },
    { assistant: { privacyNotice: "x".repeat(MAX_PRIVACY_NOTICE_LENGTH + 1) } },
  ];
  for (const body of cases) {
    const result = validateAssistant(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, "invalid_privacy_notice");
  }
});

test("auto-reanudación del humano a las 12 horas", () => {
  assert.equal(shouldAutoResumeHuman({ humanActive: false, humanActiveAt: NOW }), false);
  assert.equal(shouldAutoResumeHuman({ humanActive: true, humanActiveAt: null }), false);
  assert.equal(shouldAutoResumeHuman({ humanActive: true, humanActiveAt: new Date(NOW.getTime() - 11 * HOURS), now: NOW }), false);
  assert.equal(shouldAutoResumeHuman({ humanActive: true, humanActiveAt: new Date(NOW.getTime() - 12 * HOURS), now: NOW }), false);
  assert.equal(shouldAutoResumeHuman({ humanActive: true, humanActiveAt: new Date(NOW.getTime() - 12 * HOURS - 60_000), now: NOW }), true);
});

test("humano activo bloquea al agente; vencido se reanuda", () => {
  const recent = { humanActive: true, humanActiveAt: new Date(NOW.getTime() - 2 * HOURS) };
  assert.deepEqual(resolveConversationAutomation({ conversation: recent, now: NOW }), {
    callAgent: false,
    autoResumed: false,
    humanActive: true,
  });

  const stale = { humanActive: true, humanActiveAt: new Date(NOW.getTime() - 13 * HOURS) };
  assert.deepEqual(resolveConversationAutomation({ conversation: stale, now: NOW }), {
    callAgent: true,
    autoResumed: true,
    humanActive: false,
  });

  assert.deepEqual(resolveConversationAutomation({ conversation: { humanActive: false }, now: NOW }), {
    callAgent: true,
    autoResumed: false,
    humanActive: false,
  });
});

test("el aviso de privacidad se envía una sola vez y solo en conversación nueva", () => {
  assert.equal(shouldSendPrivacyNotice({ conversation: { privacyNoticeSentAt: null }, messagesCount: 0 }), true);
  assert.equal(shouldSendPrivacyNotice({ conversation: { privacyNoticeSentAt: new Date() }, messagesCount: 0 }), false);
  assert.equal(shouldSendPrivacyNotice({ conversation: { privacyNoticeSentAt: null }, messagesCount: 2 }), false);
  assert.equal(shouldSendPrivacyNotice({ conversation: null }), false);
});

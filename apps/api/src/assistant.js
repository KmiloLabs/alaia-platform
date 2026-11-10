// Coexistencia humano-IA y aviso de privacidad: texto por defecto, validación,
// interpolación y auto-reanudación (puro, con reloj inyectable).

export const DEFAULT_PRIVACY_NOTICE = "Este chat lo atiende un asistente de inteligencia artificial de {negocio}. Tus datos se usan solo para gestionar tu cita. Si prefieres hablar con una persona, escribe PERSONA.";
export const MAX_PRIVACY_NOTICE_LENGTH = 500;
export const HUMAN_AUTO_RESUME_HOURS = 12;

// assistant.privacyNotice guardado o el texto por defecto.
export function resolveAssistant(tenant) {
  const raw = tenant?.assistant && typeof tenant.assistant === "object" && !Array.isArray(tenant.assistant)
    ? tenant.assistant
    : {};
  const privacyNotice = typeof raw.privacyNotice === "string" ? raw.privacyNotice.trim() : "";
  return {
    privacyNotice: privacyNotice !== "" && privacyNotice.length <= MAX_PRIVACY_NOTICE_LENGTH
      ? privacyNotice
      : DEFAULT_PRIVACY_NOTICE,
  };
}

// Valida el PATCH: assistant.privacyNotice no vacío y <= 500.
export function validateAssistant(body) {
  const input = body?.assistant !== undefined ? body.assistant : body;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalid("invalid_privacy_notice", "El aviso de privacidad no es válido.");
  }
  if (input.privacyNotice === undefined) {
    return { ok: true, value: {} };
  }
  if (typeof input.privacyNotice !== "string") {
    return invalid("invalid_privacy_notice", "El aviso de privacidad debe ser texto.");
  }
  const privacyNotice = input.privacyNotice.trim();
  if (privacyNotice === "" || privacyNotice.length > MAX_PRIVACY_NOTICE_LENGTH) {
    return invalid("invalid_privacy_notice", `El aviso de privacidad debe tener entre 1 y ${MAX_PRIVACY_NOTICE_LENGTH} caracteres.`);
  }
  return { ok: true, value: { privacyNotice } };
}

// El aviso se envía una sola vez y solo en conversaciones nuevas.
export function shouldSendPrivacyNotice({ conversation, messagesCount = 0 } = {}) {
  if (!conversation) return false;
  if (conversation.privacyNoticeSentAt) return false;
  return messagesCount === 0;
}

// Auto-reanudación: humanActive vencido a las 12 h. Sin fecha no se reanuda.
export function shouldAutoResumeHuman({ humanActive, humanActiveAt, now = new Date(), hours = HUMAN_AUTO_RESUME_HOURS } = {}) {
  if (humanActive !== true) return false;
  const activeAtMs = toMillis(humanActiveAt);
  if (activeAtMs === null) return false;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return nowMs - activeAtMs > hours * 60 * 60 * 1000;
}

export function renderPrivacyNotice(template, tenantName) {
  const text = typeof template === "string" && template.trim() !== "" ? template : DEFAULT_PRIVACY_NOTICE;
  return text.replace(/\{negocio\}/g, typeof tenantName === "string" ? tenantName : "");
}

// Decide si la IA responde a un mensaje entrante: si hay humano activo, no;
// si el humano lleva más de 12 h, se auto-reanuda y la IA vuelve a responder.
export function resolveConversationAutomation({ conversation, now = new Date() } = {}) {
  const autoResumed = shouldAutoResumeHuman({
    humanActive: conversation?.humanActive,
    humanActiveAt: conversation?.humanActiveAt,
    now,
  });
  if (autoResumed) return { callAgent: true, autoResumed: true, humanActive: false };
  const humanActive = conversation?.humanActive === true;
  return { callAgent: !humanActive, autoResumed: false, humanActive };
}

export function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().getTime();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

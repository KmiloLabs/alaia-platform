// Parseo robusto de la salida del modelo. El modelo debe responder un objeto
// JSON con reply/action; si no es JSON válido se degrada a action=responder
// usando el texto tal cual (nunca se inventa una acción con efecto).

export const AGENT_ACTIONS = Object.freeze([
  "responder",
  "ofrecer_horarios",
  "reservar",
  "reprogramar",
  "cancelar",
  "derivar",
]);

const ACTION_SET = new Set(AGENT_ACTIONS);
const MAX_REPLY_LENGTH = 1200;

export function parseAgentOutput(text) {
  const raw = typeof text === "string" ? text : "";
  const trimmed = raw.trim();
  if (trimmed === "") return { reply: "", action: "responder", handoff: false, parsed: false };

  const jsonText = extractJson(trimmed);
  if (jsonText !== null) {
    let parsed = null;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const reply = firstNonEmptyString(parsed.reply, parsed.respuesta);
      const action = normalizeAction(firstNonEmptyString(parsed.action, parsed.accion));
      if (reply) {
        return {
          reply: truncateReply(reply),
          action,
          handoff: parsed.handoff === true || action === "derivar",
          parsed: true,
        };
      }
    }
  }

  return { reply: truncateReply(trimmed), action: "responder", handoff: false, parsed: false };
}

export function normalizeAction(value) {
  if (typeof value !== "string") return "responder";
  const action = value.trim().toLowerCase().replace(/\s+/g, "_");
  return ACTION_SET.has(action) ? action : "responder";
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}

function truncateReply(reply) {
  return reply.length > MAX_REPLY_LENGTH ? `${reply.slice(0, MAX_REPLY_LENGTH)}…` : reply;
}

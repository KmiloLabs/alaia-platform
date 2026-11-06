// Normalización de la acción final del agente según las herramientas que de
// verdad se ejecutaron. El modelo puede responder "responder" aunque haya
// creado/movido/cancelado una cita; la API debe decir lo que pasó.

import { AGENT_ACTIONS } from "./parse.js";

const ALLOWED_ACTIONS = new Set(AGENT_ACTIONS);

const WRITE_ACTION_BY_TOOL = Object.freeze({
  crear_cita: "reservar",
  reprogramar_cita: "reprogramar",
  cancelar_cita: "cancelar",
  derivar_a_persona: "derivar",
});

const AVAILABILITY_TOOL = "consultar_disponibilidad";

export const WRITE_TOOLS = Object.freeze(Object.keys(WRITE_ACTION_BY_TOOL));

// Reglas:
// - Una acción explícita distinta de "responder" se respeta.
// - Si el modelo dijo "responder" (o una acción inválida), manda la última
//   herramienta de escritura ejecutada: su acción si tuvo éxito; si la última
//   escritura falló, no se fuerza una acción de éxito.
// - Sin escrituras, una consulta de disponibilidad exitosa equivale a
//   "ofrecer_horarios".
export function normalizeAgentAction({ action, toolCalls = [] } = {}) {
  const explicit = typeof action === "string" ? action.trim() : "";
  if (ALLOWED_ACTIONS.has(explicit) && explicit !== "responder") return explicit;

  const calls = Array.isArray(toolCalls) ? toolCalls : [];

  const lastWrite = findLast(calls, (call) => Object.hasOwn(WRITE_ACTION_BY_TOOL, call?.name));
  if (lastWrite) {
    return lastWrite.ok === true ? WRITE_ACTION_BY_TOOL[lastWrite.name] : "responder";
  }

  const lastAvailability = findLast(calls, (call) => call?.name === AVAILABILITY_TOOL);
  if (lastAvailability) return lastAvailability.ok === true ? "ofrecer_horarios" : "responder";

  return "responder";
}

function findLast(list, predicate) {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (predicate(list[index])) return list[index];
  }
  return null;
}

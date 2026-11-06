import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_ACTIONS, normalizeAction, parseAgentOutput } from "../src/agent/parse.js";

test("parsea JSON plano con reply y action", () => {
  const result = parseAgentOutput('{"reply":"¡Hola! Tengo 9:00 y 10:30 el viernes.","action":"ofrecer_horarios"}');
  assert.equal(result.parsed, true);
  assert.equal(result.reply, "¡Hola! Tengo 9:00 y 10:30 el viernes.");
  assert.equal(result.action, "ofrecer_horarios");
  assert.equal(result.handoff, false);
});

test("parsea JSON dentro de bloque markdown y con texto alrededor", () => {
  const fenced = parseAgentOutput('Aquí va:\n```json\n{"reply":"Listo","action":"reservar"}\n```');
  assert.equal(fenced.parsed, true);
  assert.equal(fenced.action, "reservar");

  const surrounded = parseAgentOutput('Claro {"reply":"Hola","action":"responder"} fin');
  assert.equal(surrounded.parsed, true);
  assert.equal(surrounded.reply, "Hola");
});

test("acepta las claves en español del diseño n8n", () => {
  const result = parseAgentOutput('{"respuesta":"Te derivo con una persona.","accion":"derivar"}');
  assert.equal(result.reply, "Te derivo con una persona.");
  assert.equal(result.action, "derivar");
  assert.equal(result.handoff, true);
});

test("degrada a responder cuando no hay JSON válido", () => {
  for (const text of ["Hola, ¿cómo estás?", "{\"reply\":", "[1,2,3]", "   "]) {
    const result = parseAgentOutput(text);
    assert.equal(result.action, "responder", text);
    assert.equal(result.parsed, false, text);
    if (text.trim() !== "") assert.equal(result.reply, text.trim());
  }
});

test("una acción desconocida se normaliza a responder", () => {
  const result = parseAgentOutput('{"reply":"Hola","action":"inventar_cosa"}');
  assert.equal(result.action, "responder");
  assert.equal(result.parsed, true);
});

test("JSON sin reply degrada al texto original con action responder", () => {
  const result = parseAgentOutput('{"action":"reservar"}');
  assert.equal(result.action, "responder");
  assert.equal(result.parsed, false);
});

test("handoff se activa con derivar o con handoff true", () => {
  assert.equal(parseAgentOutput('{"reply":"Te paso.","action":"derivar"}').handoff, true);
  assert.equal(parseAgentOutput('{"reply":"Te paso.","action":"responder","handoff":true}').handoff, true);
});

test("normaliza nombres de acción y limita la longitud de la respuesta", () => {
  assert.equal(normalizeAction(" Ofrecer Horarios "), "ofrecer_horarios");
  assert.equal(normalizeAction("DESCONOCIDA"), "responder");
  assert.equal(normalizeAction(42), "responder");

  const long = parseAgentOutput(JSON.stringify({ reply: "x".repeat(2000), action: "responder" }));
  assert.ok(long.reply.length <= 1201);
});

test("las acciones permitidas son las del contrato", () => {
  assert.deepEqual([...AGENT_ACTIONS], ["responder", "ofrecer_horarios", "reservar", "reprogramar", "cancelar", "derivar"]);
});

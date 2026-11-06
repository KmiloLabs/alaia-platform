import test from "node:test";
import assert from "node:assert/strict";
import { WRITE_TOOLS, normalizeAgentAction } from "../src/agent/actions.js";

test("responder + crear_cita ok -> reservar (caso DeepSeek real)", () => {
  assert.equal(
    normalizeAgentAction({ action: "responder", toolCalls: [{ name: "crear_cita", ok: true }] }),
    "reservar",
  );
});

test("responder + crear_cita fallida -> responder (no se fuerza éxito)", () => {
  assert.equal(
    normalizeAgentAction({ action: "responder", toolCalls: [{ name: "crear_cita", ok: false }] }),
    "responder",
  );
});

test("responder + reprogramar/cancelar/derivar ok -> su acción", () => {
  assert.equal(
    normalizeAgentAction({ action: "responder", toolCalls: [{ name: "reprogramar_cita", ok: true }] }),
    "reprogramar",
  );
  assert.equal(
    normalizeAgentAction({ action: "responder", toolCalls: [{ name: "cancelar_cita", ok: true }] }),
    "cancelar",
  );
  assert.equal(
    normalizeAgentAction({ action: "responder", toolCalls: [{ name: "derivar_a_persona", ok: true }] }),
    "derivar",
  );
});

test("responder + solo consultar_disponibilidad ok -> ofrecer_horarios", () => {
  assert.equal(
    normalizeAgentAction({ action: "responder", toolCalls: [{ name: "consultar_disponibilidad", ok: true }] }),
    "ofrecer_horarios",
  );
});

test("responder + consultar_disponibilidad fallida -> responder", () => {
  assert.equal(
    normalizeAgentAction({ action: "responder", toolCalls: [{ name: "consultar_disponibilidad", ok: false }] }),
    "responder",
  );
});

test("una acción explícita distinta de responder se respeta", () => {
  assert.equal(
    normalizeAgentAction({ action: "ofrecer_horarios", toolCalls: [{ name: "crear_cita", ok: true }] }),
    "ofrecer_horarios",
  );
  assert.equal(
    normalizeAgentAction({ action: "reservar", toolCalls: [{ name: "cancelar_cita", ok: true }] }),
    "reservar",
  );
  assert.equal(
    normalizeAgentAction({ action: "derivar", toolCalls: [] }),
    "derivar",
  );
});

test("con varias escrituras gana la última ejecutada con éxito", () => {
  assert.equal(
    normalizeAgentAction({
      action: "responder",
      toolCalls: [
        { name: "crear_cita", ok: true },
        { name: "reprogramar_cita", ok: true },
      ],
    }),
    "reprogramar",
  );
  assert.equal(
    normalizeAgentAction({
      action: "responder",
      toolCalls: [
        { name: "crear_cita", ok: true },
        { name: "cancelar_cita", ok: true },
        { name: "crear_cita", ok: true },
      ],
    }),
    "reservar",
  );
});

test("si la última escritura falló no se fuerza la acción de éxito", () => {
  assert.equal(
    normalizeAgentAction({
      action: "responder",
      toolCalls: [
        { name: "crear_cita", ok: true },
        { name: "cancelar_cita", ok: false },
      ],
    }),
    "responder",
  );
  assert.equal(
    normalizeAgentAction({
      action: "responder",
      toolCalls: [
        { name: "crear_cita", ok: false },
        { name: "reprogramar_cita", ok: true },
      ],
    }),
    "reprogramar",
  );
});

test("escrituras con lecturas intermedias: decide la última escritura", () => {
  assert.equal(
    normalizeAgentAction({
      action: "responder",
      toolCalls: [
        { name: "consultar_disponibilidad", ok: true },
        { name: "crear_cita", ok: true },
        { name: "consultar_agenda", ok: true },
      ],
    }),
    "reservar",
  );
});

test("sin herramientas o solo lecturas que no son disponibilidad -> responder", () => {
  assert.equal(normalizeAgentAction({ action: "responder", toolCalls: [] }), "responder");
  assert.equal(normalizeAgentAction({ action: "responder" }), "responder");
  assert.equal(
    normalizeAgentAction({ action: "responder", toolCalls: [{ name: "consultar_servicios", ok: true }] }),
    "responder",
  );
  assert.equal(
    normalizeAgentAction({ action: "responder", toolCalls: [{ name: "buscar_cliente", ok: true }] }),
    "responder",
  );
});

test("acciones inválidas o toolCalls malformadas degradan a responder o a la herramienta real", () => {
  assert.equal(normalizeAgentAction({ action: "inventada", toolCalls: [] }), "responder");
  assert.equal(
    normalizeAgentAction({ action: "inventada", toolCalls: [{ name: "crear_cita", ok: true }] }),
    "reservar",
  );
  assert.equal(normalizeAgentAction({ action: undefined, toolCalls: [{}] }), "responder");
  assert.equal(normalizeAgentAction({}), "responder");
});

test("expone las herramientas de escritura normalizables", () => {
  assert.deepEqual(new Set(WRITE_TOOLS), new Set(["crear_cita", "reprogramar_cita", "cancelar_cita", "derivar_a_persona"]));
});

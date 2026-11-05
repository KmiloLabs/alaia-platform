import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const workflow = JSON.parse(await readFile(new URL("./alaia-reception-v1.json", import.meta.url), "utf8"));
const code = workflow.nodes.find((node) => node.name === "Validar evento y proponer intención").parameters.jsCode;
const handlerSource = code.slice(0, code.indexOf("\nconst incoming ="));

function classify(overrides = {}) {
  const event = {
    tenantId: "demo-ar-aan", eventId: "evt-test-001", channel: "internal_test",
    authenticatedByBackend: true, message: "Hola", ...overrides,
  };
  return vm.runInNewContext(`${handlerSource}\nhandle(event)`, { event });
}

test("plantilla inactiva y sin proveedores externos ni credenciales", () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.some((node) => node.credentials), false);
  assert.equal(workflow.nodes.some((node) => /whatsapp|google|anthropic|openai/i.test(node.type)), false);
});

test("rechaza evento sin tenant, idempotencia o autenticación declarada del backend", () => {
  const result = classify({ tenantId: "", eventId: "", authenticatedByBackend: false });
  assert.equal(result.ok, false);
  assert.deepEqual(Array.from(result.missing), ["tenantId", "eventId", "backend_authentication"]);
});

test("adapta el cuerpo HTTP que n8n entrega bajo la propiedad body", () => {
  assert.match(code, /incoming\.body \?\? incoming/);
});

test("clasifica solicitudes de negocio y solo devuelve propuestas sin ejecutarlas", () => {
  const cases = [
    ["Quiero agendar una cita", "appointment_request", "request_availability_lookup"],
    ["Necesito cancelar mi turno", "appointment_change", "request_appointment_lookup"],
    ["¿Qué me hice la última vez?", "customer_history", "request_customer_context"],
    ["¿Tienen producto en stock?", "product_question", "request_catalog_lookup"],
    ["¿Cuál es la dirección y horario?", "business_information", "request_public_business_info"],
    ["Quiero hablar con una persona", "human_handoff", "handoff_to_business"],
  ];
  for (const [message, intent, action] of cases) {
    const result = classify({ message });
    assert.equal(result.intent, intent, message);
    assert.equal(result.actionProposal.type, action, message);
    assert.equal(result.actionProposal.execute, false, message);
    assert.equal(result.controls.noBookingCreated, true, message);
  }
});

test("rechaza mensaje vacío, canal desconocido y texto excesivo", () => {
  assert.equal(classify({ message: " " }).ok, false);
  assert.equal(classify({ channel: "telegram" }).ok, false);
  assert.equal(classify({ message: "x".repeat(4001) }).ok, false);
});

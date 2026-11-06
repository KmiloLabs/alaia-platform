import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentProviderError,
  chat,
  getDefaultAgentConfig,
  getProviderRegistry,
  resolveAgentConfig,
  validateAgentConfigInput,
} from "../src/agent/providers.js";

const ENABLED_MOCK = { AGENT_ENABLE_MOCK: "true" };
const TOOL = {
  name: "consultar_disponibilidad",
  description: "Consulta horarios",
  parameters: { type: "object", properties: {}, required: [] },
};

function fakeResponse(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => data };
}

test("registro de proveedores: etiquetas, claves y modelos desde entorno", () => {
  const registry = getProviderRegistry({
    DEEPSEEK_API_KEY: "clave-deepseek",
    AGENT_MODELS_DEEPSEEK: "deepseek-chat, deepseek-custom",
    OPENAI_API_KEY: "",
    AGENT_ENABLE_MOCK: "true",
  });

  assert.deepEqual(registry.map((entry) => entry.provider), ["deepseek", "openai", "anthropic", "gemini", "mock"]);

  const deepseek = registry.find((entry) => entry.provider === "deepseek");
  assert.equal(deepseek.label, "DeepSeek");
  assert.equal(deepseek.configured, true);
  assert.deepEqual(deepseek.models, [
    { id: "deepseek-chat", label: "DeepSeek Chat" },
    { id: "deepseek-custom", label: "deepseek-custom" },
  ]);

  const openai = registry.find((entry) => entry.provider === "openai");
  assert.equal(openai.configured, false);
  assert.equal(openai.models[0].id, "gpt-4.1-mini");

  const anthropic = registry.find((entry) => entry.provider === "anthropic");
  assert.equal(anthropic.configured, false);
  assert.deepEqual(anthropic.models.map((model) => model.id), ["claude-sonnet-4-5", "claude-haiku-4-5"]);

  const mock = registry.find((entry) => entry.provider === "mock");
  assert.equal(mock.configured, true);
  assert.deepEqual(mock.models, [{ id: "mock-agent", label: "Mock agent" }]);
  assert.equal(registry.find((entry) => entry.provider === "gemini").configured, false);
});

test("mock solo está configurado con AGENT_ENABLE_MOCK=true", () => {
  assert.equal(getProviderRegistry({}).find((entry) => entry.provider === "mock").configured, false);
  assert.equal(getProviderRegistry({ AGENT_ENABLE_MOCK: "false" }).find((entry) => entry.provider === "mock").configured, false);
  assert.equal(getProviderRegistry({ AGENT_ENABLE_MOCK: "true" }).find((entry) => entry.provider === "mock").configured, true);
});

test("defaults de proveedor y modelo desde el entorno", () => {
  assert.deepEqual(getDefaultAgentConfig({}), { provider: "deepseek", model: "deepseek-chat" });
  assert.deepEqual(
    getDefaultAgentConfig({ AGENT_PROVIDER_DEFAULT: "openai", AGENT_MODEL_DEFAULT: "gpt-4.1" }),
    { provider: "openai", model: "gpt-4.1" },
  );
  assert.deepEqual(
    getDefaultAgentConfig({ AGENT_PROVIDER_DEFAULT: "openai", AGENT_MODELS_OPENAI: "gpt-x" }),
    { provider: "openai", model: "gpt-x" },
  );
  assert.deepEqual(
    getDefaultAgentConfig({ AGENT_PROVIDER_DEFAULT: "proveedor-inexistente" }),
    { provider: "deepseek", model: "deepseek-chat" },
  );
});

test("resuelve la config guardada del tenant o los defaults", () => {
  const env = { AGENT_PROVIDER_DEFAULT: "deepseek", AGENT_MODEL_DEFAULT: "deepseek-chat" };
  assert.deepEqual(resolveAgentConfig({}, env), {
    provider: "deepseek",
    model: "deepseek-chat",
    tone: "cercano",
    instructions: "",
  });
  assert.deepEqual(
    resolveAgentConfig({
      agent: { provider: "mock", model: "mock-agent", tone: "formal", instructions: "No domingos." },
    }, env),
    { provider: "mock", model: "mock-agent", tone: "formal", instructions: "No domingos." },
  );
  assert.deepEqual(resolveAgentConfig({ agent: { provider: "mock" } }, env), {
    provider: "mock",
    model: "deepseek-chat",
    tone: "cercano",
    instructions: "",
  });
});

test("valida la configuración del agente con códigos del contrato", () => {
  const env = { DEEPSEEK_API_KEY: "k", AGENT_MODELS_DEEPSEEK: "deepseek-chat,deepseek-reasoner", AGENT_ENABLE_MOCK: "true" };

  const valid = validateAgentConfigInput({ provider: "deepseek", model: "deepseek-chat", tone: "formal", instructions: "Hola" }, env);
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, { provider: "deepseek", model: "deepseek-chat", tone: "formal", instructions: "Hola" });

  const validMock = validateAgentConfigInput({ provider: "mock", model: "mock-agent" }, env);
  assert.equal(validMock.ok, true);
  assert.equal(validMock.value.tone, "cercano");

  const cases = [
    ["invalid_provider", { model: "deepseek-chat" }],
    ["invalid_provider", { provider: "no-existe", model: "x" }],
    ["invalid_provider", { provider: "openai", model: "gpt-4.1" }],
    ["invalid_model", { provider: "deepseek", model: "gpt-4.1" }],
    ["invalid_model", { provider: "deepseek" }],
    ["invalid_tone", { provider: "deepseek", model: "deepseek-chat", tone: "x".repeat(41) }],
    ["invalid_tone", { provider: "deepseek", model: "deepseek-chat", tone: 42 }],
    ["invalid_instructions", { provider: "deepseek", model: "deepseek-chat", instructions: "x".repeat(501) }],
    ["invalid_instructions", { provider: "deepseek", model: "deepseek-chat", instructions: 42 }],
  ];
  for (const [code, body] of cases) {
    const result = validateAgentConfigInput(body, env);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.code, code, JSON.stringify(body));
    assert.equal(result.status, 400);
  }
});

test("adaptador OpenAI-compatible: petición y respuesta", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return fakeResponse({
      choices: [{
        message: {
          content: "Hola",
          tool_calls: [{ id: "t1", type: "function", function: { name: "consultar_disponibilidad", arguments: "{\"durationMinutes\":30}" } }],
        },
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  };

  const result = await chat({
    provider: "openai",
    model: "gpt-4.1-mini",
    messages: [{ role: "system", content: "sys" }, { role: "user", content: "hola" }],
    tools: [TOOL],
    temperature: 0.2,
    env: { OPENAI_API_KEY: "clave-test" },
    fetchImpl,
  });

  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.equal(calls[0].options.headers.authorization, "Bearer clave-test");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, "gpt-4.1-mini");
  assert.equal(body.temperature, 0.2);
  assert.deepEqual(body.messages, [{ role: "system", content: "sys" }, { role: "user", content: "hola" }]);
  assert.deepEqual(body.tools, [{
    type: "function",
    function: { name: "consultar_disponibilidad", description: "Consulta horarios", parameters: TOOL.parameters },
  }]);

  assert.equal(result.text, "Hola");
  assert.deepEqual(result.toolCalls, [{ id: "t1", name: "consultar_disponibilidad", arguments: { durationMinutes: 30 } }]);
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 5, totalTokens: 15 });
});

test("adaptador OpenAI-compatible: convierte historial de herramientas", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return fakeResponse({ choices: [{ message: { content: "ok" } }] });
  };

  await chat({
    provider: "deepseek",
    model: "deepseek-chat",
    messages: [
      { role: "system", content: "sys" },
      { role: "user", content: "hola" },
      { role: "assistant", content: "", toolCalls: [{ id: "t1", name: "consultar_agenda", arguments: { from: "2030-03-20" } }] },
      { role: "tool", toolCallId: "t1", name: "consultar_agenda", content: "{\"ok\":true}" },
    ],
    tools: [TOOL],
    env: { DEEPSEEK_API_KEY: "k" },
    fetchImpl,
  });

  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.messages[2].role, "assistant");
  assert.equal(body.messages[2].tool_calls[0].function.name, "consultar_agenda");
  assert.equal(body.messages[2].tool_calls[0].function.arguments, "{\"from\":\"2030-03-20\"}");
  assert.deepEqual(body.messages[3], { role: "tool", tool_call_id: "t1", content: "{\"ok\":true}" });
});

test("adaptador Anthropic: petición y respuesta con tool_use", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return fakeResponse({
      content: [
        { type: "text", text: "Hola" },
        { type: "tool_use", id: "toolu_1", name: "crear_cita", input: { customerName: "Ana" } },
      ],
      usage: { input_tokens: 7, output_tokens: 3 },
    });
  };

  const result = await chat({
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    messages: [{ role: "system", content: "sys" }, { role: "user", content: "hola" }],
    tools: [TOOL],
    env: { ANTHROPIC_API_KEY: "ak" },
    fetchImpl,
  });

  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(calls[0].options.headers["x-api-key"], "ak");
  assert.equal(calls[0].options.headers["anthropic-version"], "2023-06-01");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.system, "sys");
  assert.deepEqual(body.messages, [{ role: "user", content: [{ type: "text", text: "hola" }] }]);
  assert.deepEqual(body.tools, [{ name: "consultar_disponibilidad", description: "Consulta horarios", input_schema: TOOL.parameters }]);

  assert.equal(result.text, "Hola");
  assert.deepEqual(result.toolCalls, [{ id: "toolu_1", name: "crear_cita", arguments: { customerName: "Ana" } }]);
  assert.deepEqual(result.usage, { inputTokens: 7, outputTokens: 3, totalTokens: 10 });
});

test("errores del proveedor no filtran cuerpos ni claves", async () => {
  const fetchImpl = async () => fakeResponse({ error: { message: "invalid key sk-secreta", code: "bad" } }, { ok: false, status: 401 });
  const error = await chat({
    provider: "openai",
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: "hola" }],
    env: { OPENAI_API_KEY: "sk-secreta" },
    fetchImpl,
  }).then(() => null, (caught) => caught);

  assert.ok(error instanceof AgentProviderError);
  assert.equal(error.code, "agent_provider_error");
  assert.equal(error.status, 502);
  assert.equal(error.message.includes("sk-secreta"), false);
});

test("fallo de red o JSON inválido se convierten en AgentProviderError", async () => {
  const networkError = await chat({
    provider: "gemini",
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "hola" }],
    env: { GEMINI_API_KEY: "k" },
    fetchImpl: async () => { throw new Error("ECONNREFUSED"); },
  }).then(() => null, (caught) => caught);
  assert.equal(networkError?.code, "agent_provider_error");

  const invalidJson = await chat({
    provider: "openai",
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: "hola" }],
    env: { OPENAI_API_KEY: "k" },
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error("no json"); } }),
  }).then(() => null, (caught) => caught);
  assert.equal(invalidJson?.code, "agent_provider_error");
});

test("proveedor sin clave no se puede usar", async () => {
  const error = await chat({
    provider: "openai",
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: "hola" }],
    env: {},
    fetchImpl: async () => fakeResponse({}),
  }).then(() => null, (caught) => caught);
  assert.equal(error?.code, "agent_not_configured");
  assert.equal(error?.status, 503);
});

test("mock: disponibilidad, reserva y respuesta de texto", async () => {
  const env = ENABLED_MOCK;
  const availability = await chat({
    provider: "mock",
    model: "mock-agent",
    messages: [{ role: "system", content: "sys" }, { role: "user", content: "¿Tienen hueco el viernes?" }],
    env,
  });
  assert.equal(availability.toolCalls.length, 1);
  assert.equal(availability.toolCalls[0].name, "consultar_disponibilidad");

  const booking = await chat({
    provider: "mock",
    model: "mock-agent",
    messages: [{ role: "system", content: "sys" }, { role: "user", content: "Quiero reservar el 2030-03-20T10:00" }],
    env,
  });
  assert.equal(booking.toolCalls[0].name, "crear_cita");
  assert.equal(booking.toolCalls[0].arguments.startsAt, "2030-03-20T10:00");

  const plain = await chat({
    provider: "mock",
    model: "mock-agent",
    messages: [{ role: "user", content: "Gracias" }],
    env,
  });
  assert.deepEqual(plain.toolCalls, []);
  assert.equal(JSON.parse(plain.text).action, "responder");
});

test("mock: cierre estructurado tras el resultado de la herramienta", async () => {
  const closing = await chat({
    provider: "mock",
    model: "mock-agent",
    messages: [
      { role: "user", content: "huecos" },
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "consultar_disponibilidad", arguments: {} }] },
      {
        role: "tool",
        toolCallId: "c1",
        name: "consultar_disponibilidad",
        content: JSON.stringify({ tool: "consultar_disponibilidad", ok: true, data: { slots: [{ startsAtLocal: "2030-03-20T09:00" }] } }),
      },
    ],
    env: ENABLED_MOCK,
  });
  const parsed = JSON.parse(closing.text);
  assert.equal(parsed.action, "ofrecer_horarios");
  assert.match(parsed.reply, /2030-03-20T09:00/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAgentAvailableProviders,
  buildProviderResolutions,
  toPublicProvider,
  validateProviderUpdate,
} from "../src/platform-providers.js";
import { getProviderDefinition } from "../src/agent/providers.js";

const ENV = {
  DEEPSEEK_API_KEY: "sk-env-deepseek-9999",
  AGENT_ENABLE_MOCK: "true",
};

function fakeDecrypt(value) {
  return value === "cifrado-bueno"
    ? { ok: true, value: "sk-plataforma-1234" }
    : { ok: false, code: "invalid_ciphertext" };
}

test("valida el PUT de proveedores", () => {
  const valid = validateProviderUpdate({
    enabled: true,
    apiKey: "sk-clave-valida-123",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, {
    enabled: true,
    apiKey: "sk-clave-valida-123",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
  });

  assert.deepEqual(validateProviderUpdate({}), { ok: true, value: {} });
  assert.deepEqual(validateProviderUpdate({ apiKey: null }).value, {});

  const cases = [
    ["invalid_enabled", { enabled: "true" }],
    ["invalid_enabled", { enabled: 1 }],
    ["invalid_api_key", { apiKey: "corta" }],
    ["invalid_api_key", { apiKey: "x".repeat(201) }],
    ["invalid_api_key", { apiKey: 42 }],
    ["invalid_models", { models: [] }],
    ["invalid_models", { models: "deepseek-chat" }],
    ["invalid_models", { models: Array.from({ length: 11 }, (_, index) => `m${index}`) }],
    ["invalid_models", { models: [""] }],
    ["invalid_models", { models: ["x".repeat(65)] }],
    ["invalid_models", { models: [42] }],
    ["invalid_model", { defaultModel: 42 }],
    ["invalid_model", { defaultModel: "x".repeat(65) }],
  ];
  for (const [code, body] of cases) {
    const result = validateProviderUpdate(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, code, JSON.stringify(body));
  }
});

test("resuelve la clave de plataforma cuando el documento está habilitado", () => {
  const docs = new Map([["deepseek", {
    enabled: true,
    apiKeyEnc: "cifrado-bueno",
    models: ["modelo-a", "modelo-b"],
    defaultModel: "modelo-b",
  }]]);
  const resolutions = buildProviderResolutions({
    providerIds: ["deepseek", "openai", "mock"],
    docs,
    env: ENV,
    decrypt: fakeDecrypt,
  });

  const deepseek = resolutions.find((item) => item.provider === "deepseek");
  assert.equal(deepseek.source, "platform");
  assert.equal(deepseek.configured, true);
  assert.equal(deepseek.enabled, true);
  assert.equal(deepseek.maskedKey, "…1234");
  assert.deepEqual(deepseek.models, ["modelo-a", "modelo-b"]);
  assert.equal(deepseek.defaultModel, "modelo-b");
  assert.equal(deepseek.apiKey, "sk-plataforma-1234");

  // openai no tiene doc ni clave de entorno.
  const openai = resolutions.find((item) => item.provider === "openai");
  assert.equal(openai.source, "none");
  assert.equal(openai.configured, false);
  assert.equal(openai.maskedKey, null);

  // mock está habilitado por entorno.
  const mock = resolutions.find((item) => item.provider === "mock");
  assert.equal(mock.source, "env");
  assert.equal(mock.configured, true);
  assert.equal(mock.defaultModel, "mock-agent");
});

test("si el documento está deshabilitado o no descifra, cae a entorno", () => {
  const disabled = buildProviderResolutions({
    providerIds: ["deepseek"],
    docs: new Map([["deepseek", { enabled: false, apiKeyEnc: "cifrado-bueno" }]]),
    env: ENV,
    decrypt: fakeDecrypt,
  })[0];
  assert.equal(disabled.source, "env");
  assert.equal(disabled.maskedKey, "…9999");
  assert.equal(disabled.enabled, false);

  const broken = buildProviderResolutions({
    providerIds: ["deepseek"],
    docs: new Map([["deepseek", { enabled: true, apiKeyEnc: "cifrado-roto" }]]),
    env: { DEEPSEEK_API_KEY: "sk-env-deepseek-9999" },
    decrypt: fakeDecrypt,
  })[0];
  assert.equal(broken.source, "env");

  const none = buildProviderResolutions({
    providerIds: ["deepseek"],
    docs: new Map([["deepseek", { enabled: true, apiKeyEnc: "cifrado-roto" }]]),
    env: {},
    decrypt: fakeDecrypt,
  })[0];
  assert.equal(none.source, "none");
  assert.equal(none.configured, false);
});

test("los modelos del entorno se usan si el documento no trae lista", () => {
  const resolution = buildProviderResolutions({
    providerIds: ["deepseek"],
    docs: new Map(),
    env: { ...ENV, AGENT_MODELS_DEEPSEEK: "deepseek-chat,deepseek-custom" },
    decrypt: fakeDecrypt,
  })[0];
  assert.deepEqual(resolution.models, ["deepseek-chat", "deepseek-custom"]);
  assert.equal(resolution.defaultModel, "deepseek-chat");
});

test("toPublicProvider nunca incluye la clave y available mapea etiquetas", () => {
  const resolutions = buildProviderResolutions({
    providerIds: ["deepseek", "mock"],
    docs: new Map(),
    env: ENV,
    decrypt: fakeDecrypt,
  });
  const publicProviders = resolutions.map(toPublicProvider);
  assert.equal(JSON.stringify(publicProviders).includes("sk-env-deepseek-9999"), false);
  for (const provider of publicProviders) {
    assert.equal(Object.hasOwn(provider, "apiKey"), false);
    assert.deepEqual(Object.keys(provider).sort(), [
      "configured", "defaultModel", "enabled", "label", "maskedKey", "models", "provider", "source",
    ]);
  }

  const available = buildAgentAvailableProviders(resolutions);
  const deepseek = available.find((item) => item.provider === "deepseek");
  assert.equal(deepseek.configured, true);
  assert.deepEqual(deepseek.models[0], { id: "deepseek-chat", label: "DeepSeek Chat" });
  assert.equal(getProviderDefinition("deepseek").label, "DeepSeek");
});

// Registro de proveedores del agente. Los proveedores se registran en código y
// se activan por variables de entorno: nunca hay claves en Firestore ni en el
// navegador. Cada adaptador expone la misma forma de respuesta:
//   chat({ model, messages, tools, temperature }) -> { text, toolCalls, usage }
// Sin SDKs: usa el fetch global de Node.

const PROVIDER_DEFINITIONS = {
  deepseek: {
    label: "DeepSeek",
    api: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelsEnv: "AGENT_MODELS_DEEPSEEK",
    defaultModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  openai: {
    label: "OpenAI",
    api: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    modelsEnv: "AGENT_MODELS_OPENAI",
    defaultModels: ["gpt-4.1-mini", "gpt-4.1"],
  },
  anthropic: {
    label: "Anthropic",
    api: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    modelsEnv: "AGENT_MODELS_ANTHROPIC",
    anthropicVersion: "2023-06-01",
    defaultModels: ["claude-sonnet-4-5", "claude-haiku-4-5"],
  },
  gemini: {
    label: "Google Gemini",
    api: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnv: "GEMINI_API_KEY",
    modelsEnv: "AGENT_MODELS_GEMINI",
    defaultModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
  mock: {
    label: "Mock (solo desarrollo)",
    api: "mock",
    flagEnv: "AGENT_ENABLE_MOCK",
    defaultModels: ["mock-agent"],
  },
};

const MODEL_LABELS = {
  "deepseek-chat": "DeepSeek Chat",
  "deepseek-reasoner": "DeepSeek Reasoner",
  "gpt-4.1-mini": "GPT-4.1 mini",
  "gpt-4.1": "GPT-4.1",
  "claude-sonnet-4-5": "Claude Sonnet 4.5",
  "claude-haiku-4-5": "Claude Haiku 4.5",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "mock-agent": "Mock agent",
};

export const DEFAULT_TONE = "cercano";
export const MAX_TONE_LENGTH = 40;
export const MAX_INSTRUCTIONS_LENGTH = 500;

export class AgentProviderError extends Error {
  constructor() {
    super("El proveedor del agente no respondió correctamente.");
    this.name = "AgentProviderError";
    this.code = "agent_provider_error";
    this.status = 502;
  }
}

export const PROVIDER_IDS = Object.keys(PROVIDER_DEFINITIONS);

export function getProviderDefinition(providerId) {
  const definition = PROVIDER_DEFINITIONS[providerId];
  return definition ? { ...definition, provider: providerId } : null;
}

export function getProviderDefinitions() {
  return PROVIDER_DEFINITIONS;
}

export function getModelLabel(modelId) {
  return MODEL_LABELS[modelId] ?? modelId;
}

export function getProviderDefaultModels(providerId, env = process.env) {
  return readProviderModels(providerId, env).slice();
}

export function getProviderRegistry(env = process.env) {
  return PROVIDER_IDS.map((provider) => {
    const definition = PROVIDER_DEFINITIONS[provider];
    const entry = {
      provider,
      label: definition.label,
      configured: isProviderConfigured(provider, env),
      models: readProviderModels(provider, env).map((id) => ({ id, label: MODEL_LABELS[id] ?? id })),
      envVar: definition.apiKeyEnv ?? definition.flagEnv,
    };
    return entry;
  });
}

export function getDefaultAgentConfig(env = process.env) {
  const registry = getProviderRegistry(env);
  const requested = (env.AGENT_PROVIDER_DEFAULT ?? "").trim();
  const provider = registry.some((entry) => entry.provider === requested) ? requested : "deepseek";
  const models = registry.find((entry) => entry.provider === provider)?.models ?? [];
  const requestedModel = (env.AGENT_MODEL_DEFAULT ?? "").trim();
  const model = requestedModel || models[0]?.id || "deepseek-chat";
  return { provider, model };
}

// Configuración efectiva del negocio: lo guardado en tenants/{id}.agent o los
// valores por defecto del servidor si aún no hay nada guardado.
export function resolveAgentConfig(tenant, env = process.env) {
  const defaults = getDefaultAgentConfig(env);
  const saved = tenant?.agent && typeof tenant.agent === "object" ? tenant.agent : {};
  const provider = typeof saved.provider === "string" && saved.provider.trim() !== ""
    ? saved.provider.trim()
    : defaults.provider;
  const model = typeof saved.model === "string" && saved.model.trim() !== ""
    ? saved.model.trim()
    : defaults.model;
  const tone = typeof saved.tone === "string" && saved.tone.trim() !== ""
    ? saved.tone.trim()
    : DEFAULT_TONE;
  const instructions = typeof saved.instructions === "string" ? saved.instructions : "";
  return { provider, model, tone, instructions };
}

// Validación pura de PUT /agent/config. `available` permite pasar el registro
// ya resuelto con las claves de plataforma (si no, se usa solo el entorno).
export function validateAgentConfigInput(body, env = process.env, { available = null } = {}) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const registry = Array.isArray(available) && available.length > 0 ? available : getProviderRegistry(env);
  const providerId = typeof input.provider === "string" ? input.provider.trim() : "";
  const entry = registry.find((item) => item.provider === providerId);
  if (!entry) return invalid("invalid_provider", "Selecciona un proveedor válido.");
  if (!entry.configured) return invalid("invalid_provider", "Ese proveedor no está configurado en el servidor.");

  const model = typeof input.model === "string" ? input.model.trim() : "";
  if (!entry.models.some((item) => item.id === model)) {
    return invalid("invalid_model", "Selecciona un modelo válido para el proveedor elegido.");
  }

  let tone = DEFAULT_TONE;
  if (input.tone !== undefined) {
    if (typeof input.tone !== "string") return invalid("invalid_tone", "El tono debe ser un texto corto.");
    tone = input.tone.trim();
    if (tone.length > MAX_TONE_LENGTH) {
      return invalid("invalid_tone", `El tono no puede superar ${MAX_TONE_LENGTH} caracteres.`);
    }
    if (tone === "") tone = DEFAULT_TONE;
  }

  let instructions = "";
  if (input.instructions !== undefined) {
    if (typeof input.instructions !== "string") {
      return invalid("invalid_instructions", "Las instrucciones deben ser texto.");
    }
    instructions = input.instructions.trim();
    if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
      return invalid("invalid_instructions", `Las instrucciones no pueden superar ${MAX_INSTRUCTIONS_LENGTH} caracteres.`);
    }
  }

  return { ok: true, value: { provider: entry.provider, model, tone, instructions } };
}

export function isProviderConfigured(providerId, env = process.env) {
  const definition = PROVIDER_DEFINITIONS[providerId];
  if (!definition) return false;
  if (definition.api === "mock") {
    return String(env[definition.flagEnv] ?? "").trim().toLowerCase() === "true";
  }
  const key = env[definition.apiKeyEnv];
  return typeof key === "string" && key.trim() !== "";
}

// Punto único de entrada para hablar con el proveedor elegido. `apiKey` permite
// usar una clave resuelta (por ejemplo, la guardada y cifrada en plataforma);
// si no llega, se usa la del entorno como hasta ahora.
export async function chat({
  provider,
  model,
  messages,
  tools = [],
  temperature = 0.4,
  env = process.env,
  fetchImpl = globalThis.fetch,
  apiKey = null,
  maxTokens = null,
  timeoutMs = 30_000,
}) {
  const definition = PROVIDER_DEFINITIONS[provider];
  const resolvedKey = typeof apiKey === "string" && apiKey.trim() !== "" ? apiKey.trim() : null;
  if (!definition || !(resolvedKey !== null || isProviderConfigured(provider, env))) {
    const error = new Error("agent_not_configured");
    error.code = "agent_not_configured";
    error.status = 503;
    throw error;
  }

  if (definition.api === "mock") {
    return chatMock({ messages });
  }

  const effectiveKey = resolvedKey ?? env[definition.apiKeyEnv];
  const options = { model, messages, tools, temperature, maxTokens, timeoutMs, fetchImpl };
  if (definition.api === "anthropic") {
    return chatAnthropic({ definition, apiKey: effectiveKey, ...options });
  }
  return chatOpenAICompatible({ definition, apiKey: effectiveKey, ...options });
}

async function chatOpenAICompatible({ definition, apiKey, model, messages, tools, temperature, fetchImpl, maxTokens, timeoutMs }) {
  const body = {
    model,
    messages: toOpenAIMessages(messages),
    temperature,
  };
  if (Number.isInteger(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;
  if (tools.length > 0) body.tools = tools.map(toOpenAITool);

  const data = await requestJson(fetchImpl, `${definition.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  }, timeoutMs);

  const message = data?.choices?.[0]?.message ?? {};
  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls.map((call) => ({
      id: typeof call?.id === "string" ? call.id : "",
      name: typeof call?.function?.name === "string" ? call.function.name : "",
      arguments: safeParseJson(call?.function?.arguments) ?? {},
    })).filter((call) => call.name !== "")
    : [];

  return {
    text: typeof message.content === "string" ? message.content : "",
    toolCalls,
    usage: normalizeUsage(data?.usage),
  };
}

async function chatAnthropic({ definition, apiKey, model, messages, tools, temperature, fetchImpl, maxTokens, timeoutMs }) {
  const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
  const body = {
    model,
    max_tokens: Number.isInteger(maxTokens) && maxTokens > 0 ? maxTokens : 1024,
    temperature,
    messages: anthropicMessages,
  };
  if (system) body.system = system;
  if (tools.length > 0) {
    body.tools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  const data = await requestJson(fetchImpl, `${definition.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": definition.anthropicVersion,
    },
    body: JSON.stringify(body),
  }, timeoutMs);

  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
  const toolCalls = blocks
    .filter((block) => block?.type === "tool_use" && typeof block.name === "string")
    .map((block) => ({
      id: typeof block.id === "string" ? block.id : "",
      name: block.name,
      arguments: block.input && typeof block.input === "object" ? block.input : {},
    }));

  return {
    text,
    toolCalls,
    usage: normalizeUsage({
      input_tokens: data?.usage?.input_tokens,
      output_tokens: data?.usage?.output_tokens,
      total_tokens: Number(data?.usage?.input_tokens ?? 0) + Number(data?.usage?.output_tokens ?? 0),
    }),
  };
}

// Proveedor determinista solo para desarrollo/pruebas. Comportamiento:
// - Si ya hay resultados de herramientas, responde un JSON de cierre acorde.
// - "disponib"/"horario"/"hueco" -> consultar_disponibilidad.
// - "reserva" + una fecha-hora local ISO (2030-03-20T10:00) -> crear_cita.
// - Cualquier otro texto -> responder.
function chatMock({ messages }) {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const userText = typeof lastUser?.content === "string" ? lastUser.content : "";
  const toolMessages = messages.filter((message) => message.role === "tool");

  if (toolMessages.length > 0) {
    const lastTool = safeParseJson(toolMessages.at(-1)?.content) ?? {};
    return { text: JSON.stringify(mockClosingOutput(lastTool)), toolCalls: [], usage: emptyUsage() };
  }

  if (/disponib|horario|hueco/i.test(userText)) {
    return {
      text: "",
      toolCalls: [{ id: "mock-call-1", name: "consultar_disponibilidad", arguments: {} }],
      usage: emptyUsage(),
    };
  }

  const startsAt = userText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)?.[0];
  if (/reserv/i.test(userText) && startsAt) {
    return {
      text: "",
      toolCalls: [{
        id: "mock-call-1",
        name: "crear_cita",
        arguments: {
          customerName: "Cliente de prueba",
          serviceName: "Servicio de prueba",
          startsAt,
          durationMinutes: 45,
          priceCOP: 0,
        },
      }],
      usage: emptyUsage(),
    };
  }

  return {
    text: JSON.stringify({ reply: "Entiendo. ¿En qué más te puedo ayudar?", action: "responder" }),
    toolCalls: [],
    usage: emptyUsage(),
  };
}

function mockClosingOutput(toolResult) {
  const tool = toolResult.tool;
  if (toolResult.ok === false) {
    return {
      reply: "No pude completar esa acción. ¿Quieres que te comunique con una persona?",
      action: "responder",
    };
  }
  if (tool === "consultar_disponibilidad") {
    const slots = Array.isArray(toolResult.data?.slots) ? toolResult.data.slots : [];
    const examples = slots.slice(0, 3).map((slot) => slot.startsAtLocal).join(", ");
    return {
      reply: `Tengo ${slots.length} horarios libres. Por ejemplo: ${examples || "sin horarios en el rango"}. ¿Cuál te sirve?`,
      action: "ofrecer_horarios",
    };
  }
  if (tool === "crear_cita") {
    const appointment = toolResult.data?.appointment;
    const when = appointment?.startsAtLocal ?? "el horario acordado";
    return { reply: `Listo, tu cita quedó reservada para ${when}. ¿Algo más?`, action: "reservar" };
  }
  if (tool === "reprogramar_cita") {
    return { reply: "Listo, moví tu cita al nuevo horario.", action: "reprogramar" };
  }
  if (tool === "cancelar_cita") {
    return { reply: "Listo, tu cita quedó cancelada.", action: "cancelar" };
  }
  if (tool === "derivar_a_persona") {
    return { reply: "Te comunico con una persona del negocio.", action: "derivar" };
  }
  return { reply: "Listo.", action: "responder" };
}

async function requestJson(fetchImpl, url, options, timeoutMs = 30_000) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch {
    // Nunca propagamos detalles de red ni cuerpos del proveedor al cliente.
    throw new AgentProviderError();
  }
  if (!response.ok) throw new AgentProviderError();
  try {
    return await response.json();
  } catch {
    throw new AgentProviderError();
  }
}

function toOpenAITool(tool) {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function toOpenAIMessages(messages) {
  return messages.map((message) => {
    if (message.role === "assistant" && Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
        })),
      };
    }
    if (message.role === "tool") {
      return { role: "tool", tool_call_id: message.toolCallId, content: message.content ?? "" };
    }
    return { role: message.role, content: message.content ?? "" };
  });
}

function toAnthropicMessages(messages) {
  let system = "";
  const result = [];
  const push = (role, blocks) => {
    const last = result.at(-1);
    if (last && last.role === role) last.content.push(...blocks);
    else result.push({ role, content: blocks });
  };

  for (const message of messages) {
    if (message.role === "system") {
      system += `${system ? "\n" : ""}${message.content ?? ""}`;
      continue;
    }
    if (message.role === "user") {
      push("user", [{ type: "text", text: message.content ?? "" }]);
    } else if (message.role === "assistant") {
      const blocks = [];
      if (message.content) blocks.push({ type: "text", text: message.content });
      for (const call of message.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments ?? {} });
      }
      push("assistant", blocks.length > 0 ? blocks : [{ type: "text", text: "" }]);
    } else if (message.role === "tool") {
      push("user", [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content ?? "" }]);
    }
  }
  return { system, messages: result };
}

function readProviderModels(providerId, env) {
  const definition = PROVIDER_DEFINITIONS[providerId];
  const raw = (env[definition.modelsEnv] ?? "").trim();
  if (!raw) return definition.defaultModels.slice();
  const models = raw.split(",").map((item) => item.trim()).filter(Boolean);
  return models.length > 0 ? models : definition.defaultModels.slice();
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  return {
    inputTokens,
    outputTokens,
    totalTokens: Number(usage.total_tokens ?? inputTokens + outputTokens),
  };
}

export function safeParseJson(value) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function emptyUsage() {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

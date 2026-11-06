// Proveedores de IA: validación pura y resolución efectiva (doc de plataforma
// cifrado > variable de entorno > ninguna). Sin Firestore para poder probarla
// con dobles; la persistencia vive en platform-providers-service.js.

import {
  getModelLabel,
  getProviderDefaultModels,
  getProviderDefinition,
  PROVIDER_IDS,
} from "./agent/providers.js";
import { decryptProviderKey, maskProviderKey } from "./platform-providers-crypto.js";

export const API_KEY_MIN_LENGTH = 8;
export const API_KEY_MAX_LENGTH = 200;
export const MODEL_MIN_LENGTH = 1;
export const MODEL_MAX_LENGTH = 64;
export const MAX_MODELS = 10;

// Validación pura del PUT /platform/providers/:provider.
export function validateProviderUpdate(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const value = {};

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") {
      return invalid("invalid_enabled", "El estado debe ser true o false.");
    }
    value.enabled = input.enabled;
  }

  if (input.apiKey !== undefined && input.apiKey !== null) {
    if (typeof input.apiKey !== "string") {
      return invalid("invalid_api_key", "La clave debe ser texto.");
    }
    const apiKey = input.apiKey.trim();
    if (apiKey.length < API_KEY_MIN_LENGTH || apiKey.length > API_KEY_MAX_LENGTH) {
      return invalid("invalid_api_key", "La clave debe tener entre 8 y 200 caracteres.");
    }
    value.apiKey = apiKey;
  }

  if (input.models !== undefined) {
    if (!Array.isArray(input.models) || input.models.length < 1 || input.models.length > MAX_MODELS) {
      return invalid("invalid_models", "Debes indicar entre 1 y 10 modelos.");
    }
    const models = [];
    for (const item of input.models) {
      if (typeof item !== "string") return invalid("invalid_models", "Cada modelo debe ser texto.");
      const model = item.trim();
      if (model.length < MODEL_MIN_LENGTH || model.length > MODEL_MAX_LENGTH) {
        return invalid("invalid_models", "Cada modelo debe tener entre 1 y 64 caracteres.");
      }
      models.push(model);
    }
    value.models = models;
  }

  if (input.defaultModel !== undefined && input.defaultModel !== null) {
    if (typeof input.defaultModel !== "string") {
      return invalid("invalid_model", "El modelo por defecto debe ser texto.");
    }
    const model = input.defaultModel.trim();
    if (model.length < MODEL_MIN_LENGTH || model.length > MODEL_MAX_LENGTH) {
      return invalid("invalid_model", "El modelo por defecto debe tener entre 1 y 64 caracteres.");
    }
    value.defaultModel = model;
  }

  return { ok: true, value };
}

// Resolución pura y comprobable con dobles: doc habilitado con clave descifrable,
// si no la clave de entorno, si no no configurado.
export function buildProviderResolutions({
  providerIds = PROVIDER_IDS,
  docs = new Map(),
  env = process.env,
  decrypt = decryptProviderKey,
} = {}) {
  return providerIds.map((providerId) => {
    const definition = getProviderDefinition(providerId);
    const doc = docs instanceof Map ? docs.get(providerId) : docs?.[providerId];

    const envKeyRaw = definition?.apiKeyEnv ? env?.[definition.apiKeyEnv] : null;
    const envKey = typeof envKeyRaw === "string" && envKeyRaw.trim() !== "" ? envKeyRaw.trim() : null;
    const mockEnabled = definition?.api === "mock"
      && String(env?.[definition.flagEnv] ?? "").trim().toLowerCase() === "true";

    let apiKey = null;
    let source = "none";
    if (doc && doc.enabled === true && typeof doc.apiKeyEnc === "string") {
      const decrypted = decrypt(doc.apiKeyEnc, env);
      if (decrypted.ok) {
        apiKey = decrypted.value;
        source = "platform";
      }
    }
    if (source === "none") {
      if (definition?.api === "mock") {
        if (mockEnabled) source = "env";
      } else if (envKey !== null) {
        apiKey = envKey;
        source = "env";
      }
    }

    const docModels = Array.isArray(doc?.models) && doc.models.length > 0
      ? doc.models
        .filter((model) => typeof model === "string" && model.trim() !== "")
        .map((model) => model.trim())
        .slice(0, MAX_MODELS)
      : null;
    const models = docModels ?? getProviderDefaultModels(providerId, env);
    const defaultModel = docModels && models.includes(doc?.defaultModel)
      ? doc.defaultModel
      : models[0] ?? null;

    return {
      provider: providerId,
      label: definition?.label ?? providerId,
      enabled: doc ? doc.enabled === true : true,
      configured: source !== "none",
      source,
      maskedKey: maskProviderKey(apiKey),
      models,
      defaultModel,
      apiKey,
    };
  });
}

// Quita la clave completa antes de serializar hacia el cliente.
export function toPublicProvider(resolution) {
  if (!resolution) return null;
  const { apiKey: _apiKey, ...publicProvider } = resolution;
  return publicProvider;
}

// Forma que consume GET /tenants/:id/agent/config.
export function buildAgentAvailableProviders(resolutions) {
  return resolutions.map((resolution) => {
    const definition = getProviderDefinition(resolution.provider);
    return {
      provider: resolution.provider,
      label: resolution.label,
      configured: resolution.configured,
      models: resolution.models.map((id) => ({ id, label: getModelLabel(id) })),
      envVar: definition?.apiKeyEnv ?? definition?.flagEnv,
    };
  });
}

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

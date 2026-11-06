// Persistencia y resolución con Firestore de los proveedores de IA gestionados
// por el administrador de plataforma. Las claves se guardan cifradas y la caché
// de documentos es de 60 s como máximo (se invalida al guardar/borrar).

import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import {
  chat,
  getProviderDefaultModels,
  getProviderDefinition,
  PROVIDER_IDS,
} from "./agent/providers.js";
import {
  buildProviderResolutions,
  toPublicProvider,
  validateProviderUpdate,
} from "./platform-providers.js";
import { encryptProviderKey } from "./platform-providers-crypto.js";

const CACHE_TTL_MS = 60_000;

let providerDocsCache = { loadedAt: 0, docs: new Map() };

export function invalidatePlatformProvidersCache() {
  providerDocsCache = { loadedAt: 0, docs: new Map() };
}

export async function loadPlatformProviderDocs({ force = false, now = Date.now() } = {}) {
  if (!force && providerDocsCache.loadedAt > 0 && now - providerDocsCache.loadedAt < CACHE_TTL_MS) {
    return providerDocsCache.docs;
  }
  const snapshot = await db.collection("platformProviders").get();
  const docs = new Map(snapshot.docs.map((doc) => {
    const data = doc.data() ?? {};
    return [doc.id, { ...data, provider: data.provider ?? doc.id }];
  }));
  providerDocsCache = { loadedAt: now, docs };
  return docs;
}

export async function getProviderResolutions({ env = process.env, force = false } = {}) {
  const docs = await loadPlatformProviderDocs({ force });
  return buildProviderResolutions({ providerIds: PROVIDER_IDS, docs, env });
}

export async function resolvePlatformProvider(providerId, { env = process.env, force = false } = {}) {
  if (!getProviderDefinition(providerId)) return null;
  const resolutions = await getProviderResolutions({ env, force });
  return resolutions.find((resolution) => resolution.provider === providerId) ?? null;
}

export async function listPlatformProviders({ env = process.env } = {}) {
  const resolutions = await getProviderResolutions({ env });
  return { ok: true, providers: resolutions.map(toPublicProvider) };
}

export async function savePlatformProvider({ provider, body, actorEmail = null, env = process.env }) {
  if (!getProviderDefinition(provider)) return providerNotFound();
  const validation = validateProviderUpdate(body);
  if (!validation.ok) return validation;

  const docs = await loadPlatformProviderDocs({ force: true });
  const current = docs.get(provider) ?? {};

  let apiKeyEnc = typeof current.apiKeyEnc === "string" ? current.apiKeyEnc : null;
  if (validation.value.apiKey !== undefined) {
    const encrypted = encryptProviderKey(validation.value.apiKey, env);
    if (!encrypted.ok) {
      return {
        ok: false,
        status: 500,
        code: "platform_secret_missing",
        message: "Falta PLATFORM_SECRET válido para guardar claves.",
      };
    }
    apiKeyEnc = encrypted.value;
  }

  const currentModels = Array.isArray(current.models) && current.models.length > 0 ? current.models : null;
  const models = validation.value.models ?? currentModels ?? getProviderDefaultModels(provider, env);
  let defaultModel = validation.value.defaultModel;
  if (defaultModel === undefined) {
    defaultModel = typeof current.defaultModel === "string" && models.includes(current.defaultModel)
      ? current.defaultModel
      : models[0];
  }
  if (!models.includes(defaultModel)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_model",
      message: "El modelo por defecto debe pertenecer a la lista de modelos.",
    };
  }

  const enabled = validation.value.enabled
    ?? (typeof current.enabled === "boolean" ? current.enabled : true);

  await db.collection("platformProviders").doc(provider).set({
    provider,
    enabled,
    apiKeyEnc,
    models,
    defaultModel,
    updatedAt: FieldValue.serverTimestamp(),
    updatedByEmail: actorEmail ?? null,
  }, { merge: true });

  invalidatePlatformProvidersCache();
  const resolved = await resolvePlatformProvider(provider, { env, force: true });
  return { ok: true, provider: toPublicProvider(resolved) };
}

// Borrar la configuración de plataforma vuelve a la clave de entorno o a ninguna.
export async function deletePlatformProvider({ provider, env = process.env }) {
  if (!getProviderDefinition(provider)) return providerNotFound();
  await db.collection("platformProviders").doc(provider).delete();
  invalidatePlatformProvidersCache();
  const resolved = await resolvePlatformProvider(provider, { env, force: true });
  return { ok: true, provider: toPublicProvider(resolved) };
}

// Prueba mínima: "ping" con máx. 5 tokens y timeout de 15 s. Nunca devuelve el
// cuerpo del proveedor ni la clave.
export async function testPlatformProvider({ provider, env = process.env }) {
  if (!getProviderDefinition(provider)) return providerNotFound();

  const resolved = await resolvePlatformProvider(provider, { env });
  if (!resolved || !resolved.configured) {
    return {
      ok: false,
      status: 502,
      code: "provider_test_failed",
      message: "El proveedor no está configurado.",
    };
  }

  const startedAt = Date.now();
  try {
    await chat({
      provider,
      model: resolved.defaultModel,
      messages: [{ role: "user", content: "ping" }],
      tools: [],
      temperature: 0,
      env,
      apiKey: resolved.apiKey,
      maxTokens: 5,
      timeoutMs: 15_000,
    });
    return { ok: true, latencyMs: Date.now() - startedAt, model: resolved.defaultModel };
  } catch {
    return {
      ok: false,
      status: 502,
      code: "provider_test_failed",
      message: "La prueba del proveedor falló.",
    };
  }
}

function providerNotFound() {
  return {
    ok: false,
    status: 404,
    code: "provider_not_found",
    message: "No encontramos ese proveedor en el registro.",
  };
}

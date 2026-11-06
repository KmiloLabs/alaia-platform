// Orquestación del agente: configuración por negocio, conversaciones y bucle de
// herramientas. El proveedor solo propone; las acciones las ejecuta el backend
// con el tenant de la ruta y el servicio de agenda.

import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase.js";
import { listActiveServices } from "../service-catalog.js";
import { serviceRepository } from "../service-repository.js";
import {
  chat,
  getDefaultAgentConfig,
  getProviderRegistry,
  resolveAgentConfig,
  validateAgentConfigInput,
} from "./providers.js";
import { buildAgentSystemPrompt } from "./prompts.js";
import { parseAgentOutput } from "./parse.js";
import { AGENT_TOOLS, executeTool } from "./tools.js";

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TOOL_ROUNDS = 4;
const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const FALLBACK_REPLY = "No pude completar la respuesta. ¿Quieres que te comunique con una persona del negocio?";

export function getAgentConfigForTenant(tenant, env = process.env) {
  return {
    config: resolveAgentConfig(tenant, env),
    available: getProviderRegistry(env),
    defaults: getDefaultAgentConfig(env),
  };
}

export async function saveAgentConfig({ tenantId, actorUid, body, env = process.env }) {
  const validation = validateAgentConfigInput(body, env);
  if (!validation.ok) return validation;

  await db.collection("tenants").doc(tenantId).set({
    agent: {
      ...validation.value,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    },
  }, { merge: true });

  return { ok: true, config: validation.value };
}

export async function sendAgentMessage({ tenant, actorUid, body, env = process.env }) {
  const input = validateMessageInput(body);
  if (!input.ok) return input;

  const config = resolveAgentConfig(tenant, env);
  const providerEntry = getProviderRegistry(env).find((entry) => entry.provider === config.provider);
  if (!providerEntry || !providerEntry.configured) {
    return error(503, "agent_not_configured", "El asistente no está configurado. Elige un proveedor disponible.");
  }

  const conversationsRef = db.collection("tenants").doc(tenant.id).collection("agentConversations");
  let conversationRef;
  if (input.value.conversationId) {
    conversationRef = conversationsRef.doc(input.value.conversationId);
    const snapshot = await conversationRef.get();
    if (!snapshot.exists) {
      return error(404, "conversation_not_found", "No encontramos esa conversación en el negocio.");
    }
  } else {
    conversationRef = conversationsRef.doc();
    await conversationRef.set({
      channel: "panel",
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      handoff: false,
      model: { provider: config.provider, model: config.model },
    });
  }

  const history = await loadHistory(conversationRef);
  const activeServices = await listActiveServices({
    tenantId: tenant.id,
    repository: serviceRepository,
  });
  const messages = [
    { role: "system", content: buildAgentSystemPrompt({ tenant, config, services: activeServices.services }) },
    ...history,
    { role: "user", content: input.value.message },
  ];

  await conversationRef.collection("messages").add({
    role: "user",
    content: input.value.message,
    at: FieldValue.serverTimestamp(),
  });

  let toolCalls = [];
  let finalText = "";
  let pending = messages;
  let exhausted = false;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const response = await chat({
        provider: config.provider,
        model: config.model,
        messages: pending,
        tools: AGENT_TOOLS,
        temperature: 0.4,
        env,
      });

      if (!Array.isArray(response.toolCalls) || response.toolCalls.length === 0) {
        finalText = response.text ?? "";
        break;
      }

      pending = [
        ...pending,
        { role: "assistant", content: response.text ?? "", toolCalls: response.toolCalls },
      ];

      for (const call of response.toolCalls) {
        const result = await executeTool(call.name, call.arguments, {
          tenant,
          actorUid,
          conversationId: conversationRef.id,
        });
        toolCalls.push({ name: call.name, ok: result.ok === true });
        pending = [
          ...pending,
          {
            role: "tool",
            toolCallId: call.id || `call-${toolCalls.length}`,
            name: call.name,
            content: JSON.stringify({
              tool: call.name,
              ok: result.ok,
              data: result.ok ? result.data : undefined,
              error: result.ok ? undefined : result.error,
            }),
          },
        ];
      }

      if (round === MAX_TOOL_ROUNDS - 1) exhausted = true;
    }

    if (exhausted) {
      // Cuarta vuelta agotada: pedimos un cierre sin herramientas.
      const closing = await chat({
        provider: config.provider,
        model: config.model,
        messages: pending,
        tools: [],
        temperature: 0.4,
        env,
      });
      finalText = closing.text ?? "";
    }
  } catch (providerError) {
    if (providerError?.code === "agent_provider_error") {
      return error(502, "agent_provider_error", "El proveedor del asistente no respondió. Intenta de nuevo.");
    }
    if (providerError?.code === "agent_not_configured") {
      return error(503, "agent_not_configured", "El asistente no está configurado. Elige un proveedor disponible.");
    }
    throw providerError;
  }

  const parsed = parseAgentOutput(finalText);
  const derived = toolCalls.some((call) => call.name === "derivar_a_persona" && call.ok);
  const action = derived ? "derivar" : parsed.action;
  const handoff = parsed.handoff || derived;
  const reply = parsed.reply || FALLBACK_REPLY;

  await conversationRef.collection("messages").add({
    role: "assistant",
    content: reply,
    at: FieldValue.serverTimestamp(),
    toolCalls,
  });
  await conversationRef.set({
    channel: "panel",
    updatedAt: FieldValue.serverTimestamp(),
    handoff,
    lastAction: action,
    model: { provider: config.provider, model: config.model },
  }, { merge: true });
  await trimHistory(conversationRef);

  return {
    ok: true,
    conversationId: conversationRef.id,
    reply,
    action,
    handoff,
    toolCalls,
    model: { provider: config.provider, model: config.model },
  };
}

function validateMessageInput(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (message.length < 1 || message.length > MAX_MESSAGE_LENGTH) {
    return error(400, "invalid_message", `El mensaje debe tener entre 1 y ${MAX_MESSAGE_LENGTH} caracteres.`);
  }

  let conversationId = null;
  if (input.conversationId !== undefined && input.conversationId !== null && input.conversationId !== "") {
    if (typeof input.conversationId !== "string" || !CONVERSATION_ID_PATTERN.test(input.conversationId.trim())) {
      return error(400, "invalid_conversation", "La conversación indicada no es válida.");
    }
    conversationId = input.conversationId.trim();
  }

  return { ok: true, value: { message, conversationId } };
}

async function loadHistory(conversationRef) {
  const snapshot = await conversationRef.collection("messages").orderBy("at", "asc").get();
  return snapshot.docs.slice(-MAX_HISTORY_MESSAGES).map((doc) => {
    const data = doc.data();
    return {
      role: data.role === "assistant" ? "assistant" : "user",
      content: typeof data.content === "string" ? data.content : "",
    };
  });
}

// Historial máximo 20 mensajes: se conservan los más recientes.
async function trimHistory(conversationRef) {
  const snapshot = await conversationRef.collection("messages").orderBy("at", "asc").get();
  const excess = snapshot.docs.length - MAX_HISTORY_MESSAGES;
  if (excess <= 0) return;
  const batch = db.batch();
  for (const doc of snapshot.docs.slice(0, excess)) batch.delete(doc.ref);
  await batch.commit();
}

function error(status, code, message) {
  return { ok: false, status, code, message };
}

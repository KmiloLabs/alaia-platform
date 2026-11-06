# Corte: agente configurable (proveedor y modelo)

**Objetivo:** que el dueño del negocio elija con qué proveedor y modelo trabaja el agente, sin tocar código ni reiniciar. El agente conversa, consulta disponibilidad real y propone/crea citas usando las mismas reglas del backend.

## Principios

- **Configuración, no bifurcaciones:** los proveedores se registran en código; se activan con variables de entorno. El modelo se elige por negocio y se guarda en el tenant.
- **El modelo propone, el backend decide:** el agente nunca escribe en Firestore directamente ni calcula precios. Usa herramientas (endpoints internos) que validan tenant, permisos y disponibilidad.
- **Sin secretos en Firestore ni en el navegador:** las claves de proveedor viven solo en `.env` del servidor. El navegador solo ve nombres de proveedor/modelo y si están configurados.
- **Degradación honesta:** si el proveedor no tiene clave, el agente responde `503 agent_not_configured`; nunca inventa una respuesta.

## Variables de entorno

```env
# Proveedor por defecto (cualquiera del registro)
AGENT_PROVIDER_DEFAULT=deepseek
AGENT_MODEL_DEFAULT=deepseek-chat

# Claves por proveedor (solo las que se vayan a usar)
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Modelos ofrecidos por proveedor (coma-separados). Si se omite, aplican los defaults del código.
AGENT_MODELS_DEEPSEEK=deepseek-chat,deepseek-reasoner
AGENT_MODELS_OPENAI=
AGENT_MODELS_ANTHROPIC=
AGENT_MODELS_GEMINI=

# Solo desarrollo: habilita el proveedor `mock` para pruebas deterministas.
AGENT_ENABLE_MOCK=true
```

## Registro de proveedores

| Proveedor | Tipo de API | Clave | Modelos por defecto |
|---|---|---|---|
| `deepseek` | OpenAI-compatible (`/chat/completions`) | `DEEPSEEK_API_KEY` | `deepseek-chat`, `deepseek-reasoner` |
| `openai` | OpenAI-compatible | `OPENAI_API_KEY` | `gpt-4.1-mini`, `gpt-4.1` |
| `anthropic` | Anthropic Messages (`/v1/messages`) | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5`, `claude-haiku-4-5` |
| `gemini` | OpenAI-compatible de Google | `GEMINI_API_KEY` | `gemini-2.5-flash`, `gemini-2.5-pro` |
| `mock` | Determinista, solo desarrollo | — (requiere `AGENT_ENABLE_MOCK=true`) | `mock-agent` |

Un proveedor está **configurado** si tiene clave (o es `mock` con el flag activo). Solo los configurados se pueden elegir.

## Rutas

Todas requieren Bearer y membresía activa: `/api/v1/tenants/:tenantId/agent`.

### `GET /config`

```json
{
  "config": { "provider": "deepseek", "model": "deepseek-chat", "tone": "cercano", "instructions": "" },
  "available": [
    { "provider": "deepseek", "label": "DeepSeek", "configured": true,
      "models": [ { "id": "deepseek-chat", "label": "DeepSeek Chat" } ] },
    { "provider": "anthropic", "label": "Anthropic", "configured": false, "models": [ … ] }
  ],
  "defaults": { "provider": "deepseek", "model": "deepseek-chat" }
}
```

- Si el tenant no tiene configuración, se devuelven los valores por defecto del servidor (no se escribe nada hasta que el dueño guarde).
- `instructions` es texto libre corto (máx. 500 caracteres) del negocio: horarios especiales, políticas, tono.

### `PUT /config`

```json
{ "provider": "openai", "model": "gpt-4.1-mini", "tone": "formal", "instructions": "No agendamos los domingos." }
```

- Valida que el proveedor exista y esté configurado (`400 invalid_provider`), que el modelo pertenezca a ese proveedor (`400 invalid_model`) y los límites de textos (`400 invalid_instructions`, `400 invalid_tone`).
- Guarda en `tenants/{tenantId}.agent`.
- Devuelve la misma forma que `GET /config`.

### `POST /messages`

```json
{ "conversationId": "opcional", "message": "Hola, ¿tienen hueco el viernes?" }
```

Respuesta:

```json
{
  "conversationId": "abc123",
  "reply": "¡Hola! Tengo 9:00 y 10:30 el viernes 6. ¿Cuál te sirve?",
  "action": "ofrecer_horarios",
  "handoff": false,
  "toolCalls": [ { "name": "consultar_disponibilidad", "ok": true } ],
  "model": { "provider": "deepseek", "model": "deepseek-chat" }
}
```

- `action` ∈ `responder` | `ofrecer_horarios` | `reservar` | `reprogramar` | `cancelar` | `derivar`.
- `handoff: true` cuando el agente deriva a una persona.
- Sin `conversationId` se crea una conversación nueva; con uno existente se continúa (máximo 20 mensajes de historial).
- `503 agent_not_configured` si el proveedor elegido no tiene clave.
- `502 agent_provider_error` si el proveedor falla; el mensaje de error del proveedor no se filtra al cliente.

## Herramientas del agente

El agente recibe herramientas con esquema estricto; el backend las ejecuta con el `tenantId` de la ruta (el modelo no puede elegirlo).

| Herramienta | Qué hace | Reutiliza |
|---|---|---|
| `consultar_disponibilidad` | Busca huecos libres en un rango y duración. | `availability.js` |
| `consultar_agenda` | Lista las citas del negocio en un rango. | consulta de citas |
| `crear_cita` | Crea una cita con confirmación previa del cliente. | lógica de creación |
| `reprogramar_cita` | Mueve una cita existente. | lógica de reprogramación |
| `cancelar_cita` | Cancela una cita existente. | lógica de cancelación |
| `derivar_a_persona` | Marca la conversación para atención humana. | — |

Reglas: máximo 4 vueltas de herramientas por mensaje; toda acción con efecto (crear, mover, cancelar) exige que el cliente la haya confirmado en la conversación; el agente nunca inventa precios, horarios ni historial.

## Prompt del sistema

Se compone en el servidor con: nombre y zona horaria del negocio, fecha y hora actuales en esa zona, horario de atención, instrucciones del dueño, tono y las reglas del contrato (breve, sin markdown, un emoji, derivar ante urgencias, no inventar). Se inspira en el workflow `Recepcionista epresarial IA` (ver `docs/agente-recepcion-n8n.md`), sin datos quemados ni Google Calendar.

## Conversaciones (datos)

- `tenants/{tenantId}/agentConversations/{conversationId}`: `channel` (`panel` por ahora), `startedAt`, `updatedAt`, `handoff`, `model` y mensajes en subcolección `messages` (`role`, `content`, `at`, `toolCalls` resumidos). Retención mínima; no se guardan audios ni transcripciones completas.
- El `conversationId` no autoriza nada por sí solo: siempre se resuelve dentro del tenant de la ruta.

## Panel

- Sección **Configuración → Asistente IA**: elegir proveedor y modelo entre los `available` (los no configurados aparecen deshabilitados con la razón), campo de instrucciones y tono, botón guardar, y un botón **“Probar”** que envía un mensaje de prueba y muestra la respuesta y la acción.
- Si no hay ningún proveedor configurado, muestra cómo activarlo (qué variable de entorno falta) sin exponer claves.

## Pruebas

- Unitarias: registro de proveedores, validación de config, construcción del prompt, parseo de la respuesta estructurada, adaptadores OpenAI-compatible y Anthropic con `fetch` simulado, y ejecutores de herramientas con datos falsos.
- End-to-end: con `mock` activo, configurar el agente, enviar un mensaje y comprobar que la herramienta de disponibilidad se ejecutó y que el modelo elegido aparece en la respuesta; aislar entre dos negocios.
- Sin claves reales no se llama a ningún proveedor externo.

## Fuera de alcance

WhatsApp (entrada real), audio, recordatorios, cobros y memoria de largo plazo. Este corte entrega el agente usable desde el panel y su API.

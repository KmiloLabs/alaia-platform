# Corte: canal de WhatsApp (oficial) con modo de prueba

**Objetivo:** que los mensajes de WhatsApp de cada negocio lleguen al agente de Alaia y sus respuestas salgan por WhatsApp, con el número correcto para cada negocio. Mientras no exista la cuenta de Meta, todo funciona en **modo de prueba local** con el mismo código.

**Fuera de alcance:** Embedded Signup de Meta, plantillas aprobadas, recordatorios programados, botones/interactivos, audio e imágenes (solo texto en este corte).

## 1. Modelo

- **Una app de Meta para Alaia.** Cada negocio conecta su número; el webhook es único.
- Colección `whatsappNumbers/{phoneNumberId}`:
  ```json
  { "phoneNumberId": "123", "tenantId": "abc", "displayPhone": "+57 300 111 2222", "wabaId": "456", "status": "active", "connectedAt": "<timestamp>" }
  ```
  El mapeo número → negocio es determinista: se busca por `phoneNumberId`. El teléfono del cliente **nunca** elige el negocio.
- Un negocio puede tener un número activo (si hay más, gana el más reciente; se documenta).
- Conversación: `tenants/{id}/agentConversations/{conversationId}` con `channel: "whatsapp"`, `customerPhone`, `customerId` si existe.

## 2. Variables de entorno

| Variable | Uso |
|---|---|
| `WHATSAPP_MODE` | `off` (por defecto), `sandbox` (no envía, registra) o `live` |
| `WHATSAPP_VERIFY_TOKEN` | Verificación del webhook (GET) |
| `WHATSAPP_APP_SECRET` | Firma `X-Hub-Signature-256` del webhook |
| `WHATSAPP_TOKEN` | Token de la app para enviar (Graph API) |
| `WHATSAPP_API_VERSION` | Por defecto `v23.0` |
| `WHATSAPP_GRAPH_URL` | Por defecto `https://graph.facebook.com` |

`off`: el webhook responde 503 `whatsapp_disabled` y el panel avisa que no está activo.

## 3. Webhook

- `GET /api/v1/webhooks/whatsapp` (público): valida `hub.mode=subscribe` y `hub.verify_token`; responde `hub.challenge` en texto plano; si no coincide → 403.
- `POST /api/v1/webhooks/whatsapp` (público):
  1. Verifica `X-Hub-Signature-256` con HMAC-SHA256 sobre el **cuerpo crudo** y `WHATSAPP_APP_SECRET` (comparación en tiempo constante). Firma inválida → 401 `invalid_signature`.
  2. Responde `200` inmediato y procesa después (Express: responder y seguir con la promesa, sin bloquear).
  3. Ignora eventos que no sean mensajes de texto entrantes (`statuses`, audio, etc.).
  4. Deduplica por `message.id` en `whatsappMessages/{id}` (transacción: si ya existe, no reprocesar).
  5. Resuelve `phoneNumberId` → `tenantId`. Si no hay mapeo, registra y descarta (200, sin revelar nada).
  6. Crea o reutiliza el cliente por teléfono; llama al agente (`sendAgentMessage`) con el texto y guarda la respuesta.
  7. Envía la respuesta con Graph API (`POST /{version}/{phoneNumberId}/messages`, `type: "text"`). En `sandbox` solo registra en `whatsappOutbox` (colección por tenant o log) sin llamar a Meta.

- Ruta de prueba del panel (con sesión del negocio): `POST /tenants/:tenantId/channel/whatsapp/test` `{ text }` → ejecuta el mismo pipeline (cliente + agente + conversación con `channel: "whatsapp"`) pero **no envía**; responde `{ reply, action, toolCalls, model, conversationId }`.

## 4. Panel

### Configuración → Canal de WhatsApp
- Estado: **No configurado**, **Conectado** (`+57…`) o **Modo de prueba**.
- Si es dueño: campo de `phoneNumberId` para que el administrador de plataforma lo asocie (por ahora se asocia automáticamente si hay un único negocio? **No**: el mapeo solo lo crea el administrador de plataforma; en el panel del negocio solo se muestra el estado).
- Botón "Probar el canal": abre un chat de prueba (simula un mensaje entrante del cliente).

### Canal de prueba (chat)
- Caja de texto + historial de la conversación de prueba (mismo agente y herramientas reales).
- Aviso: "Mensajes de prueba: no se envían por WhatsApp".
- Útil para demos a prospectos.

### Plataforma → Negocios: conectar número
- En el detalle del negocio, campo `phoneNumberId` + "Conectar" / "Desconectar" (solo administrador de plataforma). Crea/borra el mapeo en `whatsappNumbers`.

## 5. Pruebas

Unidades: verificación de firma (válida/inválida/timing-safe), normalización del payload, dedupe, mapeo número→negocio, modo `off`.

E2E (extender `scripts/verify-slice.mjs`, con `WHATSAPP_MODE=sandbox`):

1. `GET webhook` con token incorrecto → 403; con el correcto → devuelve `hub.challenge`.
2. `POST webhook` con firma inválida → 401.
3. `POST webhook` con firma válida y mensaje de texto → 200; el agente responde y queda registro de la conversación con `channel: "whatsapp"`; reintentar el mismo `message.id` no duplica.
4. Mensaje de un `phoneNumberId` sin mapeo → 200 y se descarta.
5. `POST /tenants/:id/channel/whatsapp/test` → respuesta del agente y conversación de prueba; no crea envíos reales.
6. En `off`, el webhook responde 503.

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

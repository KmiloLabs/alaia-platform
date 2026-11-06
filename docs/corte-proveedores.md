# Corte: proveedores de IA gestionados desde el panel de plataforma

**Objetivo:** que el dueño de ALAIA agregue, cambie, active o desactive proveedores de IA desde su panel, sin editar archivos ni reiniciar la API. Las claves se guardan cifradas y nunca se muestran completas.

**Fuera de alcance:** límites de gasto automáticos, rotación programada de claves, proveedores con formatos nuevos (se mantiene el registro actual: deepseek, openai, anthropic, gemini, mock).

## 1. Dónde se guardan

Colección `platformProviders/{providerId}` (solo la escribe el administrador de plataforma):

```json
{
  "provider": "deepseek",
  "enabled": true,
  "apiKeyEnc": "v1:<iv>:<tag>:<ciphertext>",
  "models": ["deepseek-chat", "deepseek-reasoner"],
  "defaultModel": "deepseek-chat",
  "updatedAt": "<timestamp>",
  "updatedByEmail": "tu@correo.com"
}
```

- `apiKeyEnc` se cifra con **AES-256-GCM** usando `PLATFORM_SECRET` (hex de 64 caracteres en `.env`).
- Formato del texto cifrado: `v1:<ivBase64>:<tagBase64>:<datosBase64>`.
- **Nunca** se devuelve la clave: las respuestas muestran solo `maskedKey` (`…` + últimos 4 caracteres).
- **Nunca** se escribe la clave en logs ni en errores.
- Si `PLATFORM_SECRET` falta o es inválido, `PUT` con `apiKey` responde `500 platform_secret_missing`. Leer y borrar siguen funcionando.

## 2. Resolución efectiva del proveedor

Para cada proveedor del registro se calcula:

1. Si existe documento con `enabled: true` y `apiKeyEnc` descifrable → **clave de plataforma**.
2. Si no, si hay clave en entorno (`DEEPSEEK_API_KEY`, etc.) → **clave de entorno**.
3. Si no hay clave → **no configurado**.

`source`: `"platform"`, `"env"` o `"none"`. Los modelos salen del documento si vienen; si no, del registro por defecto. El precio/comportamiento del agente no cambia: solo la forma de obtener la clave.

Todo esto se resuelve **en cada petición** (con caché en memoria de 60 s como máximo); agregar una clave desde el panel debe surtir efecto sin reiniciar la API.

## 3. Rutas (solo administrador de plataforma)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/v1/platform/providers` | — | `{ providers: [{ provider, label, enabled, configured, source, maskedKey, models, defaultModel }] }` |
| PUT | `/api/v1/platform/providers/:provider` | `{ enabled?, apiKey?, models?, defaultModel? }` | `{ provider }` (sin clave) |
| DELETE | `/api/v1/platform/providers/:provider` | — | `{ provider: { ..., source: "env" \| "none" } }` |
| POST | `/api/v1/platform/providers/:provider/test` | — | `{ ok: true, latencyMs, model }` o `502 provider_test_failed` |

Validaciones:
- `provider` debe existir en el registro → `404 provider_not_found`.
- `apiKey`: texto de 8–200 caracteres → `400 invalid_api_key`.
- `models`: 1–10 textos de 1–64 caracteres → `400 invalid_models`; `defaultModel` debe estar en la lista → `400 invalid_model`.
- `enabled` booleano → `400 invalid_enabled`.
- El `test` usa un mensaje mínimo ("ping") con máximo 5 tokens; tiempo límite 15 s. Nunca devuelve la clave ni el cuerpo del proveedor. `mock` con `AGENT_ENABLE_MOCK` responde ok sin red.

`GET /tenants/:id/agent/config` debe seguir mostrando `available` con `configured: true` cuando el proveedor tenga clave de plataforma o de entorno.

## 4. Prueba (trial) de negocios

- Al crear un negocio: `plan: "trial"` y `trialEndsAt = ahora + TRIAL_DAYS días` (por defecto 14, configurable por `.env`).
- `GET /platform/tenants` y `GET /me/tenants` devuelven `plan`, `trialEndsAt` y `trialDaysLeft` (entero, 0 si venció y no hay fecha).
- No se suspende automáticamente: el administrador decide. En el panel se muestra "Prueba: N días" o "Prueba vencida".
- Negocios existentes sin `trialEndsAt`: `trialDaysLeft` se calcula como `null` y el panel muestra "Sin fecha de prueba".

## 5. Panel

### Plataforma → Proveedores de IA
- Una tarjeta por proveedor con: nombre, estado (`Configurado por ti`, `Configurado por variable de entorno`, `Sin configurar`), clave enmascarada, modelos y modelo por defecto.
- Acciones: **Agregar o cambiar clave** (campo tipo password, nunca se rellena), **activar/desactivar**, editar modelos y modelo por defecto, **Probar conexión** (muestra latencia o el error) y **Quitar configuración** (vuelve a la de entorno).
- Aviso claro: las claves se guardan cifradas y no se pueden ver después de guardarlas.

### Plataforma → Negocios
- Nueva columna o etiqueta con los días de prueba restantes.

### Negocio → Configuración → Asistente IA
- Sin cambios de comportamiento: sigue mostrando los proveedores disponibles, ahora con los que el administrador haya configurado.

## 6. Criterios de aceptación

Unidades: cifrado/descifrado (ida y vuelta, clave incorrecta, formato inválido), validaciones de PUT, resolución con y sin documento, cálculo de `trialDaysLeft`.

E2E (extender `scripts/verify-slice.mjs`):

1. `GET /platform/providers` como admin → lista con `source` y `maskedKey` (sin clave completa).
2. Como dueño normal → `403 not_platform_admin`.
3. `PUT` con clave para `mock` → 200; `GET` posterior muestra `maskedKey` y `source: "platform"`; la clave no aparece en la respuesta.
4. `PUT` con `models: []` → `400 invalid_models`; `defaultModel` fuera de la lista → `400 invalid_model`.
5. `POST .../test` con `mock` → 200 `ok: true`.
6. `DELETE` → vuelve a `source: "env"` o `"none"`.
7. Negocio nuevo → `plan: "trial"` y `trialDaysLeft` mayor que 0.

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

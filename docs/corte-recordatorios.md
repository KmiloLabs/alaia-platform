# Corte: recordatorios automáticos por WhatsApp

**Objetivo:** avisar al cliente por WhatsApp antes de su cita (por ejemplo 24 h y 2 h antes) para reducir inasistencias. El dueño lo activa, elige los avisos y edita el texto.

**Fuera de alcance:** recordatorios por correo o SMS, plantillas aprobadas de Meta (en modo `live` con clientes reales puede requerir plantilla), reprogramación automática de inasistencias.

## 1. Configuración por negocio

Campo nuevo en `tenants/{tenantId}`:

```json
{
  "reminders": {
    "enabled": true,
    "firstHoursBefore": 24,
    "secondHoursBefore": 2,
    "message": "Hola {nombre}, te recordamos tu cita en {negocio} el {fecha} a las {hora}. Responde SI para confirmar."
  }
}
```

Reglas:
- `enabled`: booleano (por defecto `false`).
- `firstHoursBefore`: entero 0–168 (0 = no enviar ese aviso). Por defecto 24.
- `secondHoursBefore`: entero 0–168 (0 = no enviar). Por defecto 2.
- Si `enabled` es true, al menos uno de los dos debe ser > 0 → `invalid_reminder_schedule`.
- `message`: ≤300 caracteres, con variables permitidas: `{nombre}`, `{negocio}`, `{fecha}`, `{hora}`, `{servicio}`. Cualquier otra variable → `invalid_reminder_message`.
- `PATCH /tenants/:tenantId` acepta `reminders` (solo dueño). `GET /context` lo devuelve.

## 2. Programación

Colección `tenants/{tenantId}/reminders/{reminderId}`:

```json
{
  "appointmentId": "abc",
  "kind": "first" | "second",
  "sendAt": "<timestamp>",
  "customerName": "Camila",
  "customerPhone": "3001234567",
  "startsAtLocal": "2026-11-20T10:00",
  "serviceName": "Corte clásico",
  "status": "pending" | "sent" | "skipped" | "failed",
  "createdAt": "<timestamp>",
  "sentAt": null,
  "error": null
}
```

- Al **crear** una cita (panel o agente o pública): si el negocio tiene recordatorios activos, calcular `sendAt = inicio − N horas`; si `sendAt` ya pasó o el inicio no es futuro, no programar (no se envía un recordatorio de algo que ya pasó).
- Al **cancelar**: marcar `skipped` los pendientes de esa cita.
- Al **reprogramar**: marcar `skipped` los pendientes y reprogramar con el nuevo inicio.
- No duplicar: un recordatorio por `appointmentId + kind`.

## 3. Ejecución

Endpoint para un disparador externo (cron):

`POST /api/v1/tasks/reminders/run` con cabecera `X-Cron-Secret: <CRON_SECRET>` (variable de entorno; si no está definida, 503 `cron_disabled`).

- Toma hasta 50 recordatorios `pending` con `sendAt <= ahora` (orden ascendente).
- Para cada uno:
  - Si el negocio suspendió recordatorios o la cita está cancelada → `skipped`.
  - Si el cliente no tiene teléfono → `skipped` con nota.
  - Si el canal WhatsApp está en `sandbox` → escribe en `whatsappOutbox` (sin enviar) y marca `sent` (prueba real del flujo).
  - En `live` → envía por Graph API; si falla, `failed` con error (sin reintento infinito: máximo 3 intentos, campo `attempts`).
- Respuesta: `{ processed, sent, skipped, failed }` (sin datos personales).

Un cron externo gratuito (por ejemplo cron-job.org) llama a la URL cada 5 minutos con el secreto.

## 4. Panel

### Configuración → Recordatorios (tarjeta nueva)
- Interruptor **"Enviar recordatorios por WhatsApp"**.
- Dos avisos: **"Primer aviso"** (por defecto 24 h antes) y **"Segundo aviso"** (2 h antes), cada uno con opción de desactivar (0).
- Campo de mensaje (300 caracteres) con contador y ayuda de variables: `{nombre}`, `{negocio}`, `{fecha}`, `{hora}`, `{servicio}`.
- Vista previa del mensaje con datos de ejemplo.
- Aviso: "Para enviarse de verdad, el canal de WhatsApp debe estar conectado."
- Guardar con el mismo `PATCH` del negocio; estados de éxito/error.
- Indicador de recordatorios programados (opcional): número de `pending` de los próximos 7 días (ruta `GET /tenants/:id/reminders/summary`).

## 5. Pruebas

Unidades: validación de configuración, cálculo de `sendAt`, variables permitidas, interpolación del mensaje, ventana de 24/2 h, recordatorio en el pasado no se programa, cancelación los marca `skipped`.

E2E (extender `scripts/verify-slice.mjs`):

1. PATCH con recordatorios activos → 200 y `context` lo devuelve.
2. Crear cita a 2 días → se crean 2 recordatorios `pending` (24 h y 2 h).
3. Crear cita a 3 h → solo el de 2 h.
4. Cancelar cita → recordatorios `skipped`.
5. `POST /tasks/reminders/run` con secreto incorrecto → 401; sin `CRON_SECRET` → 503.
6. Forzar `sendAt` en el pasado (doble interno o PATCH de prueba) → `run` procesa, escribe en outbox (sandbox) y marca `sent`.
7. Validaciones: ambos avisos en 0 → 400; mensaje con variable desconocida → 400; mensaje > 300 → 400.

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

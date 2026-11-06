# Corte: panel real con citas guardadas

**Objetivo:** convertir el panel de demostración en una aplicación con sesión real y citas persistidas, aisladas por negocio. Sigue el orden del plano (§12): identidad y autorización primero, agenda después, con datos ficticios y entorno local.

## Entorno local (emuladores)

- Proyecto Firebase ficticio: `demo-alaia` (nunca `novara-bot`).
- Auth: `http://127.0.0.1:9099` · Firestore: `http://127.0.0.1:8081` · UI: `http://127.0.0.1:4000`.
  (El 8080 está ocupado por Evolution API en esta máquina; por eso Firestore usa 8081.)
- API: `http://localhost:3001` · Panel: `http://localhost:5173`.
- Arranque: `npm run emulators`, luego `npm run dev:api` y `npm run dev:web` (en terminales separadas).
- `.env` se copia de `.env.example`; está ignorado por Git.

## Autenticación

- El panel usa **Firebase Auth** (correo/contraseña) contra el emulador.
- Tras iniciar sesión envía `Authorization: Bearer <ID token>` en cada llamada a la API.
- La API valida el token con Firebase Admin (`requireUser`) y después la membresía del negocio (`requireTenantMembership`). El rol y el `tenantId` **nunca** se aceptan desde el navegador.

## Rutas existentes (no cambian)

- `POST /api/v1/tenants` `{ name, sector, timeZone }` — crea negocio, slug y membresía `owner`.
- `GET /api/v1/me/tenants` — negocios donde el usuario tiene membresía activa.
- `GET /api/v1/tenants/:tenantId/context` — contexto del negocio activo.

## Rutas nuevas

Todas bajo `/api/v1/tenants/:tenantId`, con Bearer válido y membresía activa.

### `GET /appointments?from=YYYY-MM-DD&to=YYYY-MM-DD`

Rango por fecha local del negocio. Responde ordenado por inicio ascendente:

```json
{ "appointments": [ {
  "appointmentId": "…", "customerName": "Mariana López", "customerPhone": null,
  "serviceName": "Corte clásico", "startsAt": "2026-11-06T19:00:00.000Z",
  "startsAtLocal": "2026-11-06T14:00", "durationMinutes": 45, "priceCOP": 50000,
  "status": "scheduled", "notes": "", "createdAt": "…"
} ] }
```

### `POST /appointments`

```json
{
  "customerName": "Mariana López",
  "customerPhone": "+57 300 000 0000",
  "serviceName": "Corte clásico",
  "startsAt": "2026-11-06T14:00",
  "durationMinutes": 45,
  "priceCOP": 50000,
  "notes": "",
  "clientRequestId": "uuid-opcional"
}
```

- `startsAt` llega **sin zona**: es hora local del negocio y se interpreta con `tenant.timeZone`.
- Se guarda como `Timestamp` UTC más el texto local para reproducir la hora original.
- Respuesta `201` con `{ "appointment": { … } }`.
- Con el mismo `clientRequestId` en el mismo negocio responde `200` y la cita ya existente (no duplica).
- `409 appointment_conflict` si se cruza con otra cita activa del mismo negocio (un solo profesional en el piloto).
- `400` con códigos concretos: `invalid_name`, `invalid_service`, `invalid_start`, `invalid_duration`, `invalid_price`, `invalid_range`.

### `POST /appointments/:appointmentId/cancel`

- Cambia `status` a `cancelled`, registra evento y responde `{ "appointment": { … } }`.
- `404 appointment_not_found` si no existe o no pertenece al negocio.
- Cancelar dos veces responde `200` con la cita ya cancelada (idempotente).

### `GET /availability?from=YYYY-MM-DD&to=YYYY-MM-DD&durationMinutes=45&stepMinutes=30`

Devuelve los horarios libres del negocio dentro de su horario de atención: nunca en el pasado, nunca solapando citas activas, rango máximo de 31 días y hasta 300 horarios en orden ascendente.

```json
{ "timeZone": "America/Bogota", "durationMinutes": 45, "stepMinutes": 30,
  "slots": [ { "startsAt": "2026-11-06T14:00:00.000Z", "startsAtLocal": "2026-11-06T09:00" } ] }
```

El horario vive en `openingHours` (`[{ "day": 1..7, "open": "09:00", "close": "18:00" }]`, 1 = lunes; un día ausente está cerrado) y `slotStepMinutes`. Por defecto: lunes a sábado 09:00–18:00, paso 30. `POST /tenants` acepta valores personalizados y `GET /context` los devuelve (con los valores por defecto si el negocio es anterior a este corte).

Errores: `invalid_range`, `invalid_duration`, `invalid_step`.

### `POST /appointments/:appointmentId/reschedule`

```json
{ "startsAt": "2026-11-06T15:00", "durationMinutes": 60 }
```

- Mueve la cita; si no se envía `durationMinutes` conserva la actual.
- `409 appointment_conflict` si el nuevo horario se cruza con otra cita activa.
- `409 appointment_cancelled` si la cita ya estaba cancelada.
- `404 appointment_not_found` si no existe en el negocio.
- Registra un evento `rescheduled` con el valor anterior y el nuevo.

## Reglas de datos

- Ruta: `tenants/{tenantId}/appointments/{appointmentId}`.
- Eventos append-only: `tenants/{tenantId}/appointments/{appointmentId}/events/{eventId}` con `type` (`created`, `cancelled`), `actorUid` y `at`.
- `status`: `scheduled` o `cancelled`. Una cita cancelada no bloquea el horario.
- Índice/consulta siempre acotada por `tenantId` (subcolección del negocio).
- Validaciones: nombre 2–80, servicio 2–80, duración 5–480 min, precio entero 0–10.000.000 COP, duración y precio obligatorios.

## Panel web

- Sin sesión → pantalla de acceso (crear cuenta o entrar) con el mismo lenguaje visual de `styles.css`.
- Con sesión y sin negocio → formulario para crear el negocio (nombre, sector, zona horaria).
- Con sesión y uno o más negocios → selector de negocio activo; se recuerda en `localStorage`.
- El panel carga las citas reales del día elegido y permite crearlas y cancelarlas contra la API.
- Los ingresos se calculan con las citas reales del periodo (día/semana/mes), no con cifras fijas.
- Se retiran los textos "datos de muestra" y el aviso de demostración del diálogo.
- Botón para cerrar sesión y cambiar de negocio.

## Fuera de alcance de este corte

WhatsApp, IA, pagos, inventario, página pública de reservas, invitaciones y consola de plataforma. No se cargan datos reales de clientes.

## Criterios de aceptación

1. Una cuenta nueva puede registrarse, crear su negocio y ver el panel con la agenda vacía.
2. Una cita creada desaparece al recargar y sigue ahí al volver a iniciar sesión (persistida).
3. Dos citas solapadas en el mismo negocio: la segunda se rechaza y el panel explica por qué.
4. Un usuario del negocio A no puede leer ni escribir citas del negocio B manipulando el `tenantId` (404/403) — comprobado por script.
5. Repetir la creación con el mismo `clientRequestId` no duplica la cita.
6. La disponibilidad solo ofrece horas dentro del horario del negocio, nunca pasadas ni ocupadas, y respeta la zona horaria del negocio.
7. Reprogramar a un horario ocupado falla con 409 y no deja la agenda inconsistente.

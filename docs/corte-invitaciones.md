# Corte: acceso de trabajadores por invitación

**Objetivo:** que el dueño invite a sus barberos/estilistas por QR/WhatsApp/correo, que ellos entren con su cuenta de Google y vean **solo su agenda** desde el celular o el computador.

**Fuera de alcance:** sincronización con Google Calendar (queda documentada en la sección 6, se implementa después), facturación electrónica, permisos finos por módulo y app nativa.

## 1. Roles

`membership.role` ya admite `owner`, `admin`, `professional` y `client`. Se usa así:

| Rol | Ve | Puede |
|---|---|---|
| `owner` | todo el negocio | todo |
| `admin` | todo el negocio | todo menos plataforma |
| `professional` | solo sus citas y su liquidación | marcar asistencia; nada más |

- La membresía de un profesional guarda `professionalId` (vínculo con el registro de Equipo).
- Un profesional **no** puede crear/editar citas, servicios, clientes, equipo, configuración, invitaciones ni ver liquidaciones de otros.
- Respuesta de `GET /tenants/:id/context` incluye `membership: { role, professionalId }` (ya incluye `role`).

## 2. Invitaciones

Colección `tenants/{tenantId}/invitations/{invitationId}`:

```json
{
  "id": "auto",
  "professionalId": "abc",
  "professionalName": "Andrés",
  "email": "",
  "phone": "3001234567",
  "role": "professional",
  "tokenHash": "<sha256>",
  "status": "pending",
  "expiresAt": "<timestamp>",
  "createdBy": "<uid>",
  "acceptedBy": null,
  "acceptedAt": null
}
```

- El **token** es aleatorio (32 bytes, base64url). Solo se guarda su `sha256`; el enlace con el token se devuelve **una sola vez** al crearlo.
- Vigencia: `INVITATION_DAYS` (7 por defecto).
- Al menos uno de `email` o `phone` es obligatorio → `400 invalid_invitee`.
- Estados: `pending`, `accepted`, `cancelled`, `expired`.

### Rutas

| Método | Ruta | Quién | Respuesta |
|---|---|---|---|
| POST | `/tenants/:tenantId/invitations` | dueño/admin | `201 { invitation: { id, link, qrPayload, expiresAt, professionalName } }` |
| GET | `/tenants/:tenantId/invitations` | dueño/admin | `{ invitations: [...] }` (sin token ni hash) |
| DELETE | `/tenants/:tenantId/invitations/:invitationId` | dueño/admin | `200` (cancela) |
| GET | `/invitations/:token` | público | `{ tenant: { name, slug }, professional: { name }, email, expiresAt, valid }` |
| POST | `/invitations/:token/accept` | autenticado | `200 { membership: { tenantId, role, professionalId } }` |

- `link`: URL absoluta `PUBLIC_APP_URL/invite/<token>`. Si `PUBLIC_APP_URL` no está configurada, usar `http://localhost:5173`.
- `qrPayload`: el mismo enlace (el panel genera el QR en el navegador; el backend no genera imágenes).
- Aceptar:
  - Crea/actualiza `tenants/{id}/memberships/{uid}` con `role: "professional"`, `professionalId`, `status: "active"`, y marca la invitación `accepted`.
  - Si ya era miembro del negocio: `409 invitation_already_member`.
  - Token inválido: `404 invitation_not_found`; vencido: `410 invitation_expired`; cancelada o aceptada: `409 invitation_not_pending`.
- El correo/teléfono son informativos: no se envían mensajes en este corte (el dueño comparte el enlace por WhatsApp o muestra el QR).

## 3. Restricciones del profesional

- `GET /tenants/:tenantId/appointments?from&to` con rol `professional` devuelve **solo** las citas con su `professionalId`.
- Nuevo `POST /tenants/:tenantId/appointments/:appointmentId/status` con `{ status: "completed" | "no_show" | "scheduled" }`:
  - permitido a dueño/admin y al profesional **asignado** a esa cita (cualquier otro: `403 forbidden`).
  - guarda `status`, `statusChangedAt`, `statusChangedBy`; `cancelled` no se toca por esta ruta.
- Escrituras de servicios, clientes, equipo, configuración, invitaciones y liquidación: solo `owner`/`admin` (`403 not_owner` ya existente para `owner`; el admin también debe poder).

## 4. Estados de la cita y liquidación

Estados válidos: `scheduled`, `completed`, `no_show`, `cancelled`.

- Ingresos y liquidación cuentan `scheduled` y `completed`.
- `cancelled` y `no_show` no suman.
- `GET /appointments` y el resumen devuelven `status`.

## 5. Panel

### Login con Google
- Botón "Continuar con Google" en la pantalla de acceso (Firebase Auth, proveedor Google).
- En el emulador funciona con cuentas de prueba; en producción requiere configurar el cliente OAuth (documentar en README).

### Invitaciones (Equipo)
- En cada profesional: botón **Invitar**.
- Diálogo: correo y/o teléfono; genera enlace + **QR** (dibujado en el navegador) + botón **Compartir por WhatsApp** (`https://wa.me/?text=...`) + **Copiar enlace** + opción "Enviar por correo" (`mailto:` como respaldo, sin servidor de correo).
- Aviso de que el enlace vence en 7 días y que se muestra una sola vez.
- Lista de invitaciones pendientes por profesional con estado y opción de cancelar.

### Pantalla de aceptación (pública)
- Ruta `/invite/<token>` (hash): muestra negocio y profesional, y el botón "Aceptar invitación" (pide login con Google si no hay sesión).
- Errores claros: vencida, ya aceptada, ya eres miembro.

### Panel del profesional
- Si el rol es `professional`, el menú muestra **Mi agenda** (y nada más de gestión).
- "Mi agenda": sus citas de hoy y próximas, con cliente, servicio, hora y estado; botones **Atendida** y **No asistió**.
- Ve su comisión del mes si la API la expone; si no, se omite en este corte.

## 6. Google Calendar (documentado, no implementado)

- Firestore sigue siendo la fuente de verdad.
- Integración opcional por negocio: OAuth con el dueño, tokens cifrados (reusar `PLATFORM_SECRET`), crear/actualizar/borrar eventos al cambiar citas.
- Sincronización de vuelta con **watch channel + syncToken** (incremental), nunca lectura completa.
- Si Google falla: la operación local se completa igual y se reintenta en cola; nunca se bloquea ni se duplica una cita.
- Se implementa en un corte posterior, con pruebas de fallo simulado.

## 7. Criterios de aceptación

Unidades: validación de invitación, hash de token, vencimiento, transición de estados de cita.

E2E (extender `scripts/verify-slice.mjs`):

1. Dueño crea invitación para un profesional → 201 con link/QR; el token no aparece en el listado.
2. `GET /invitations/:token` público → 200 con negocio y profesional.
3. Un usuario nuevo (con Google o correo) acepta → membresía `professional` con `professionalId`; repetir aceptar → 409.
4. Token inventado → 404; vencido → 410 (crear invitación con fecha pasada por API interna o esperar; se prueba con doble unitario).
5. El profesional ve **solo sus citas** y no puede editar servicios (403).
6. El profesional marca "Atendida" en su cita → 200; otro profesional no puede (403).
7. La liquidación cuenta `completed` y no `no_show`.

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

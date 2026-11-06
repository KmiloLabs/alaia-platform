# Corte: página pública de reservas

**Objetivo:** cada negocio tiene un enlace público (por ejemplo `alaia.app/b/barberia-auran`) con su información, servicios, equipo, horarios y un flujo de reserva sin cuenta. La cita entra a la misma agenda del panel.

**Fuera de alcance:** dominio propio por negocio, pagos, personalización avanzada (logo/tema), páginas de marketing de Alaia y Google Calendar.

## 1. Identidad pública

- El negocio ya tiene `slug` único (`tenantSlugs`).
- URL pública: `PUBLIC_APP_URL` + `/b/<slug>`. Por defecto `http://localhost:5173/b/<slug>`.
- Solo se expone información pública: nombre, sector, descripción, dirección, teléfono, redes, zona horaria, horario, servicios activos y profesionales activos. **Nunca** correo del dueño, precios de costo, comisiones, clientes ni citas.

## 2. Rutas públicas (sin autenticación)

Todas bajo `/api/v1/public`, con límite de peticiones por IP (máx. 60 por minuto; reservas máx. 10 por hora por IP y slug) → `429 too_many_requests`.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/public/tenants/:slug` | `{ tenant: { name, slug, sector, description, address, phone, socialLinks, timeZone }, services: [...], professionals: [...] }` |
| GET | `/public/tenants/:slug/availability?date=YYYY-MM-DD&serviceId=&professionalId=` | `{ date, timeZone, durationMinutes, slots: [{ startsAtLocal }] }` |
| POST | `/public/tenants/:slug/appointments` | `201 { appointment: { appointmentId, startsAtLocal, serviceName, professionalName, status } }` |

### Detalles

- `services`: solo activos, con `serviceId`, `name`, `description`, `category`, `durationMinutes`, `priceCOP`. Sin límite práctico (pocos).
- `professionals`: solo activos, con `professionalId`, `name`. Sin teléfono ni correo.
- `availability`: si viene `serviceId`, la duración sale del servicio (no se acepta `durationMinutes` del cliente); si no viene, 30 minutos. `date` obligatoria (un solo día) y dentro de los próximos 60 días.
- `POST appointments` (reserva pública):
  ```json
  {
    "customerName": "Camila Rojas",
    "customerPhone": "3001234567",
    "serviceId": "abc",
    "professionalId": "xyz",
    "startsAt": "2026-11-20T10:00",
    "clientRequestId": "opcional-uuid"
  }
  ```
  - Valida: nombre 2–80, teléfono 7–15 dígitos (`invalid_customer_phone`), servicio activo del negocio (`service_not_found`), profesional activo si viene (`professional_not_found`), hora futura y dentro del horario (`outside_business_hours`), sin conflicto (`409 appointment_conflict`).
  - Crea/reutiliza el cliente por teléfono (misma lógica del panel).
  - Guarda la cita con `source: "public"`, `priceCOP` y `durationMinutes` del servicio.
  - Idempotente por `clientRequestId` (mismo negocio): repetir devuelve `200` con la misma cita.
  - No revela si el negocio está suspendido: responde `404 tenant_not_found`.
- Errores de negocio inexistente o suspendido: `404 tenant_not_found`.

## 3. Página pública (panel web)

- Ruta `/b/<slug>` (path o hash), sin sesión.
- **Encabezado:** nombre, sector, descripción, dirección, teléfono y redes sociales con enlaces.
- **Servicios:** tarjetas con nombre, duración y precio; botón "Reservar".
- **Equipo:** profesionales activos (solo nombre); si hay más de uno, el cliente puede elegir.
- **Reserva:** elegir servicio → fecha → hueco disponible → nombre y teléfono → confirmar. Mensaje de éxito con fecha, hora, servicio y profesional.
- Si el negocio no tiene servicios, mostrar "Este negocio aún no tiene servicios disponibles".
- Estados de carga, error, sin horarios y conflicto (elegir otro horario sin perder lo escrito).
- Responsive (la mayoría de clientes entra desde el celular), tema claro.
- En el panel del negocio: tarjeta "Tu página pública" con el enlace, botón copiar, QR y "Abrir página".

## 4. Pruebas

Unidades: validación de slug, cálculo de disponibilidad pública, validación de reserva pública, límite de intentos.

E2E (extender `scripts/verify-slice.mjs`):

1. `GET /public/tenants/:slug` devuelve el negocio con servicios y profesionales, sin datos privados (sin `ownerEmail`, sin `commission`, sin teléfonos de profesionales).
2. `GET availability` con `serviceId` usa la duración del servicio.
3. `POST appointment` pública crea la cita y aparece en la agenda del dueño; el cliente queda en Clientes con su teléfono.
4. Repetir con el mismo `clientRequestId` → 200 y una sola cita.
5. Reservar un horario ocupado → 409.
6. Negocio suspendido o slug inexistente → 404.
7. Límite de reservas: más de 10 en una hora desde la misma IP → 429 (prueba unitaria del limitador).

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

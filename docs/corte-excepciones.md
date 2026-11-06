# Corte: excepciones de horario por fecha

**Objetivo:** que el negocio abra un domingo puntual, cierre un festivo o cambie el horario de un día concreto, sin tocar el horario semanal. Ejemplo: domingo normal cerrado, pero el domingo 15 de noviembre abierto de 10:00 a 14:00.

**Fuera de alcance:** feriados automáticos por país, excepciones por profesional, horarios de varias sedes.

## 1. Datos

Campo nuevo en `tenants/{tenantId}`:

```json
{
  "dateOverrides": [
    { "date": "2026-11-15", "closed": false, "open": "10:00", "close": "14:00" },
    { "date": "2026-11-17", "closed": true }
  ]
}
```

Reglas:
- Máximo **120** excepciones → `invalid_date_overrides`.
- Cada `date` válida `YYYY-MM-DD` → `invalid_override_date`; sin repetir → `duplicate_override_date`.
- Si `closed` es `false` (o falta): `open` y `close` válidos y `open < close` → `invalid_override_hours`.
- Si `closed` es `true`: se ignoran `open`/`close`.
- Los negocios sin el campo se comportan como hoy (horario semanal). Valores guardados viejos o inválidos se ignoran al leer (no rompen la agenda).

`PATCH /api/v1/tenants/:tenantId` acepta `dateOverrides` (solo dueño) y **reemplaza la lista completa**. `GET /context` y `GET /me/tenants` lo devuelven.

## 2. Cálculo del horario efectivo

Nueva función pura en `availability.js`:

```js
resolveEffectiveWindows(tenant, dateString) -> [{ open, close }]
```

- Si hay excepción para esa fecha: `closed` → `[]`; si no, el rango de la excepción.
- Si no hay excepción: los tramos del día de la semana según `openingHours`.

`generateAvailabilitySlots` acepta `dateOverrides` y usa `resolveEffectiveWindows` por fecha: la excepción **manda sobre el horario semanal**.

Todo lo que ya usa la disponibilidad (panel, página pública, agente) hereda el cambio sin código extra.

## 3. Validación al reservar

- La reserva del panel y la pública deben aceptar horas dentro del horario **efectivo** de esa fecha: si el domingo 15 está abierto 10:00–14:00, se puede reservar a las 10:00 aunque el domingo esté cerrado normalmente.
- Un día cerrado por excepción no acepta reservas (`outside_business_hours`).
- La reprogramación usa la misma regla.

## 4. Agente

- El prompt incluye hasta 5 excepciones próximas (desde hoy, ordenadas por fecha): `2026-11-15 abierto 10:00-14:00; 2026-11-17 cerrado`.
- Regla nueva: "Las excepciones mandan sobre el horario semanal; no ofrezcas horarios de un día cerrado."

## 5. Panel

### Configuración → Horario de atención
- Nueva sección **"Fechas especiales"** dentro de la tarjeta de horario.
- Lista de excepciones (solo futuras por defecto, con opción de ver pasadas): fecha legible ("dom 15 nov"), estado **Abierto 10:00–14:00** (verde) o **Cerrado** (café/rojo), y botón eliminar.
- Formulario: fecha (mínimo hoy), tipo Abierto/Cerrado; si es abierto, horas de apertura y cierre. Botón "Agregar fecha".
- Se guardan junto con el horario semanal (mismo PATCH) y refrescan el contexto.
- Estados de carga/guardado/error y validación visible.

### Agenda y página pública
- Sin cambios de UI: los horarios del domingo 15 aparecen o desaparecen solos.

## 6. Pruebas

Unidades: validación de excepciones (forma, fecha, duplicados, horas, máximo), `resolveEffectiveWindows`, disponibilidad con excepción abierta/cerrada, reserva dentro/fuera de la excepción.

E2E (extender `scripts/verify-slice.mjs`):

1. PATCH con una excepción abierta un domingo futuro → 200 y `context` la devuelve.
2. `availability` de ese domingo devuelve horarios solo dentro de 10:00–14:00; el resto de domingos sigue cerrado.
3. Reserva a las 10:00 de ese domingo → 201; a las 16:00 → `400 outside_business_hours`.
4. Excepción `closed` en un día laborable → `availability` vacío y reserva → 400.
5. Validaciones: fecha inválida, duplicada, open >= close, más de 120 → 400.
6. La página pública y el agente reflejan la excepción.

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

# Corte: horarios por negocio y catálogo de servicios

**Objetivo:** que el agente y el panel dejen de usar un horario fijo y servicios inventados. Cada negocio define su horario real y sus servicios con precio y duración; el agente cotiza y agenda con esos datos.

**Fuera de alcance:** clientes (CRM), profesionales, sedes, split de horario (pausa de almuerzo) y WhatsApp.

## 1. Horario del negocio

Se guardan dos campos en el documento del negocio (`tenants/{tenantId}`):

```json
{
  "openingHours": [
    { "day": 1, "open": "09:00", "close": "18:00" },
    { "day": 2, "open": "09:00", "close": "18:00" }
  ],
  "slotStepMinutes": 30
}
```

- `day`: 1 = lunes … 7 = domingo.
- `open`/`close`: `"HH:MM"` en hora local del negocio; `open < close`.
- **Un rango por día como máximo** en este corte. Un día ausente = cerrado. Split de horario queda para después.
- `slotStepMinutes`: 5–240, por defecto 30.
- Si el negocio no tiene los campos, se usa el horario por defecto: lunes a sábado 9:00–18:00, domingo cerrado, paso 30 (comportamiento actual).

`resolveOpeningHours` y `resolveSlotStepMinutes` de `apps/api/src/availability.js` ya existen y son la única fuente de verdad para la disponibilidad.

### Ruta

`PATCH /api/v1/tenants/:tenantId` — solo el dueño (`membership.role === "owner"`).

Body (los dos campos son opcionales, pero si vienen deben ser válidos):

```json
{ "openingHours": [ ... ], "slotStepMinutes": 30 }
```

Respuestas:
- `200 { "tenant": { "id", "name", "slug", "sector", "timeZone", "openingHours", "slotStepMinutes" } }`
- `400 invalid_hours` — día repetido, día fuera de 1–7, `open`/`close` inválidos o `open >= close`.
- `400 invalid_slot_step` — fuera de 5–240.
- `400 empty_update` — sin ninguno de los dos campos.
- `403 not_owner` — membresía sin rol de dueño.
- `404 tenant_not_found` — negocio inexistente o ajeno (mismo código que hoy).

La respuesta de `GET /tenants/:tenantId/context` y `GET /me/tenants` debe incluir `openingHours` y `slotStepMinutes`.

### Efecto en la disponibilidad

`GET /availability` usa el horario guardado. Ejemplo: domingo 10:00–14:00 abierto genera huecos ese domingo; si está cerrado, responde lista vacía (no es error).

## 2. Catálogo de servicios

Colección `tenants/{tenantId}/services/{serviceId}`.

Campos:

```json
{
  "id": "auto",
  "name": "Corte clásico",
  "description": "",
  "category": "Cortes",
  "durationMinutes": 45,
  "priceCOP": 50000,
  "active": true,
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>"
}
```

Validaciones:
- `name`: 2–80 caracteres → `invalid_service_name`.
- `description`: ≤300 → `invalid_service_description`.
- `category`: ≤40 → `invalid_service_category`.
- `durationMinutes`: entero 5–480 → `invalid_duration`.
- `priceCOP`: entero 0–10.000.000 → `invalid_price`.
- Nombre único por negocio (sin distinguir mayúsculas) → `409 service_name_taken`.

### Rutas

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/tenants/:tenantId/services?includeInactive=1` | — | `200 { "services": [ ... ] }` |
| POST | `/tenants/:tenantId/services` | `{ name, description?, category?, durationMinutes, priceCOP }` | `201 { "service": { ... } }` |
| PATCH | `/tenants/:tenantId/services/:serviceId` | campos parciales | `200 { "service": { ... } }` |
| DELETE | `/tenants/:tenantId/services/:serviceId` | — | `200 { "service": { ... "active": false } }` (borrado lógico) |

- `404 service_not_found` para servicio inexistente o de otro negocio.
- `403 not_owner` para quien no es dueño.
- `GET` público interno: cualquier miembro puede listar; escribir solo el dueño.

## 3. Agente con servicios reales

### Nueva herramienta `consultar_servicios`

```json
{ "name": "consultar_servicios", "arguments": { "query": "corte" } }
```

- `query` opcional (texto, ≤60). Sin query devuelve todos los activos.
- Devuelve `{ "ok": true, "data": { "count": 3, "services": [{ "id", "name", "durationMinutes", "priceCOP" }] } }`, máximo 20.
- Sin servicios activos: `{ "ok": true, "data": { "count": 0, "services": [] } }`.

### `crear_cita` con `serviceId`

- Nuevo argumento opcional `serviceId`.
- Si viene: el backend busca el servicio activo del negocio y **sobrescribe** `serviceName`, `durationMinutes` y `priceCOP` con los del catálogo. Lo que envíe el modelo para esos campos se ignora.
- Si no viene: se mantiene el comportamiento actual (texto libre, precio 0) por compatibilidad, pero el prompt indica preferir `serviceId`.
- Servicio inexistente o inactivo: la herramienta responde `{ "ok": false, "error": "service_not_found" }` y el agente lo explica sin crear la cita.

### prompt del sistema

- Incluye una lista compacta de servicios activos (máx. 15): `nombre — 45 min — $50.000`.
- Incluye el horario del negocio por día.
- Instruye: no inventar precios ni horarios; si el servicio no está en la lista, decirlo y ofrecer transferir a una persona; nunca cotizar distinto al catálogo.

## 4. Panel

### Configuración → Horario de atención

- 7 filas (lunes a domingo), cada una con interruptor abierto/cerrado y, si está abierta, hora de apertura y de cierre.
- Selector de intervalo entre citas: 15, 30, 45 o 60 minutos.
- Guardar con `PATCH /tenants/:tenantId`; estados de éxito y error; validación visible (cierre mayor que apertura, al menos un día abierto).
- Al guardar, refrescar el contexto del negocio.

### Servicios

- Activar la entrada "Servicios" del menú (hoy existe y no hace nada).
- Lista con nombre, categoría, duración y precio formateado en pesos; botón "Nuevo servicio".
- Formulario: nombre, categoría, descripción, duración (minutos) y precio; crear y editar.
- Desactivar servicio con confirmación; los inactivos no aparecen en la lista principal (filtro "ver inactivos" opcional).
- Estados de carga, vacío ("Aún no tienes servicios"), error y `403` con mensaje claro.

### Agenda

- En el diálogo de nueva cita, selector de **Servicio** (opcional). Al elegirlo, se rellenan duración y precio, y los chips de horarios se recalculan con la duración del servicio.
- Si el negocio no tiene servicios, el selector muestra "Sin servicios configurados" y se mantiene la captura manual.

## 5. Criterios de aceptación

Pruebas unitarias nuevas: validación de horario (días repetidos, horas inválidas, umbral), validación de servicios, herramienta `consultar_servicios`, `crear_cita` con `serviceId` sobrescribiendo precio/duración.

Verificación end-to-end (extender `scripts/verify-slice.mjs`):

1. `PATCH` horario: domingo 10:00–14:00 → `GET /availability` devuelve huecos ese domingo; restaurar a cerrado → lista vacía.
2. `PATCH` con día repetido → `400 invalid_hours`.
3. Servicios: crear, listar, editar precio, desactivar; `409` por nombre duplicado; `400` por duración y precio inválidos.
4. `403` al intentar escribir con una cuenta que no es dueña (o `404` si no es miembro).
5. El agente (mock) sigue creando citas sin romper.
6. Prueba manual con DeepSeek real: el agente consulta servicios y cotiza el precio del catálogo.

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

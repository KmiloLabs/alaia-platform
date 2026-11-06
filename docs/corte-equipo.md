# Corte: equipo (profesionales) y comisiones

**Objetivo:** que cada negocio tenga sus trabajadores, asigne citas a cada uno, consulte disponibilidad por profesional y configure cómo se le paga (porcentaje, fijo, alquiler o mixto).

**Fuera de alcance:** liquidaciones cerradas con historial inmutable, invitaciones por correo, roles de acceso (recepción/profesional) y turnos rotativos automáticos.

## 1. Profesionales

Colección `tenants/{tenantId}/professionals/{professionalId}`:

```json
{
  "id": "auto",
  "name": "Andrés",
  "phone": "3001234567",
  "email": "",
  "notes": "",
  "active": true,
  "commission": {
    "type": "percentage",
    "percent": 50,
    "amountCOP": 0,
    "rentCOP": 0,
    "effectiveFrom": "2026-11-06"
  },
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>"
}
```

Validaciones:
- `name`: 2–80 → `invalid_professional_name`; único por negocio (sin distinguir mayúsculas) → `409 professional_name_taken`.
- `phone`: opcional, 7–15 dígitos → `invalid_professional_phone`.
- `email`: opcional, formato básico ≤120 → `invalid_professional_email`.
- `notes`: ≤200 → `invalid_professional_notes`.
- `commission.type`: `percentage` | `fixed` | `rent` | `mixed` → `invalid_commission_type`.
- `percent`: entero 0–100 (obligatorio en percentage/mixed) → `invalid_percent`.
- `amountCOP`: entero 0–10.000.000 (obligatorio en fixed) → `invalid_amount`.
- `rentCOP`: entero 0–10.000.000 (obligatorio en rent/mixed) → `invalid_rent`.
- `effectiveFrom`: fecha `YYYY-MM-DD` → `invalid_effective_from`.

Rutas (leer: cualquier miembro; escribir: dueño):
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/tenants/:tenantId/professionals?includeInactive=1` | `{ professionals, total }` |
| POST | `/tenants/:tenantId/professionals` | `201 { professional }` |
| PATCH | `/tenants/:tenantId/professionals/:professionalId` | `200 { professional }` |
| DELETE | `/tenants/:tenantId/professionals/:professionalId` | `200 { professional active:false }` (lógico) |

`404 professional_not_found` para profesional de otro negocio. `403 not_owner` para quien no es dueño.

## 2. Citas asignadas

- `POST /appointments` acepta `professionalId` opcional. Si viene, debe pertenecer al negocio (`404 professional_not_found`).
- La cita guarda `professionalId` y `professionalName` (copia del momento).
- **Conflicto:** dos citas se cruzan si se solapan **y** tienen el mismo `professionalId`, considerando `null` como un cupo compartido ("sin asignar"). Es decir, dos citas sin asignar se cruzan entre sí; una asignada y una sin asignar no se cruzan.
- `reschedule` conserva el profesional; acepta `professionalId` opcional para reasignar (validando conflicto del nuevo).
- `GET /appointments` devuelve ambos campos.

## 3. Disponibilidad por profesional

`GET /availability` acepta `professionalId` opcional.

- Sin `professionalId`: comportamiento actual (todo el negocio; las citas asignadas a cualquier profesional ocupan el hueco).
- Con `professionalId`: un hueco está libre si no hay cita solapada **de ese profesional** ni cita **sin asignar** solapada.
- Si el profesional no existe o es de otro negocio → `404 professional_not_found`.

## 4. Comisiones y liquidación (vista previa)

`GET /api/v1/tenants/:tenantId/settlements/preview?from=YYYY-MM-DD&to=YYYY-MM-DD` (dueño).

Reglas de cálculo por profesional, con citas `scheduled` del rango (canceladas no cuentan):
- `percentage`: `commission = round(gross × percent / 100)`.
- `fixed`: `commission = amountCOP × número de citas`.
- `rent`: `commission = 0`; `rent = round(rentCOP × días del rango / días del mes de `to`)`.
- `mixed`: `commission = round(gross × percent / 100)`; `rent` prorrateado igual que arriba.
- `net = commission − rent` (puede ser negativo en alquiler).
- Citas sin profesional no entran en el reparto (pero sí en `gross` general del negocio, que se devuelve aparte).

Respuesta:

```json
{
  "from": "2026-11-01",
  "to": "2026-11-30",
  "timeZone": "America/Bogota",
  "business": { "services": 40, "gross": 2000000 },
  "professionals": [
    { "professionalId": "abc", "name": "Andrés", "services": 20, "gross": 1000000, "commission": 500000, "rent": 0, "net": 500000 }
  ],
  "unassigned": { "services": 0, "gross": 0 }
}
```

- `from`/`to` obligatorios, `from <= to`, máximo 92 días → `invalid_range`.
- `professional_not_found` no aplica aquí; profesionales inactivos sí se incluyen si tienen citas.

## 5. Panel

### Equipo (menú hoy muestra "próximamente")
- Lista con nombre, teléfono, comisión resumida ("50%", "$15.000 por servicio", "Alquiler $300.000") y estado.
- Alta y edición: nombre, teléfono, correo, notas y configuración de comisión (tipo + valores + vigencia).
- Desactivar con confirmación y filtro "Ver inactivos".

### Agenda
- En "Nueva cita" y en reprogramar: selector de **profesional** (opcional si el negocio no tiene; obligatorio si tiene más de uno).
- Los chips de horarios se piden con el profesional elegido.
- La fila de la cita muestra el nombre del profesional o "Sin asignar".

### Liquidación (en Equipo)
- Selector de rango de fechas y botón "Calcular".
- Tabla por profesional: citas, producido, comisión, alquiler y neto; total del negocio y citas sin asignar.

## 6. Criterios de aceptación

Unidades: validaciones de profesional, unicidad de nombre, conflicto por profesional y por cupo compartido, disponibilidad filtrada, cálculo de comisiones de los cuatro tipos y prorrateo del alquiler.

E2E (extender `scripts/verify-slice.mjs`):

1. Crear dos profesionales; nombre duplicado → 409; validaciones → 400.
2. Dos citas a la misma hora para profesionales distintos → 200 ambas; para el mismo → 409.
3. `availability` con profesional A excluye su cita pero no la de B.
4. Cita sin asignar bloquea a cualquier profesional en `availability`.
5. `settlements/preview` con 50% y con alquiler → números exactos.
6. B no ve los profesionales de A (404).

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

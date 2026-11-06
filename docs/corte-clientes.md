# Corte: clientes con ficha e historial

**Objetivo:** que cada negocio tenga sus clientes reales, que cada cita quede vinculada a un cliente y que el agente reconozca a quien vuelve. Es la base del CRM y del historial.

**Fuera de alcance:** empleados/profesionales, sedes, etiquetas, campañas de marketing y recordatorios automáticos.

## 1. Datos

Colección `tenants/{tenantId}/customers/{customerId}`:

```json
{
  "id": "auto",
  "name": "Camila Rojas",
  "phone": "3001234567",
  "email": "",
  "notes": "",
  "active": true,
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>"
}
```

Validaciones:
- `name`: 2–80 → `invalid_customer_name`.
- `phone`: opcional; se normaliza quitando todo lo que no sea dígito; si viene debe tener 7–15 dígitos → `invalid_customer_phone`.
- `email`: opcional, formato básico, ≤120 → `invalid_customer_email`.
- `notes`: ≤300 → `invalid_customer_notes`.
- **Teléfono único por negocio** (solo entre clientes activos e inactivos del mismo tenant) → `409 customer_phone_taken`.

Un cliente sin teléfono es válido (cliente de mostrador); un cliente con teléfono se puede reconocer en WhatsApp más adelante.

## 2. Rutas

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/tenants/:tenantId/customers?query=&includeInactive=1` | — | `200 { "customers": [...], "total": n }` |
| GET | `/tenants/:tenantId/customers/:customerId` | — | `200 { "customer": {...}, "appointments": [...] }` |
| POST | `/tenants/:tenantId/customers` | `{ name, phone?, email?, notes? }` | `201 { "customer": {...} }` |
| PATCH | `/tenants/:tenantId/customers/:customerId` | campos parciales | `200 { "customer": {...} }` |
| DELETE | `/tenants/:tenantId/customers/:customerId` | — | `200 { "customer": { ..., "active": false } }` |

- Leer: cualquier miembro del negocio. Escribir: solo dueño (`403 not_owner`).
- `query` busca por nombre o teléfono (sin distinguir mayúsculas ni tildes), máx. 40 caracteres.
- `GET` de detalle devuelve además las últimas 50 citas del cliente ordenadas de más reciente a más antigua.
- `404 customer_not_found` para cliente inexistente o de otro negocio.

## 3. Citas vinculadas

`POST /appointments` acepta `customerId` opcional.

- Si viene: el backend comprueba que el cliente pertenece al negocio (`404 customer_not_found`) y copia `customerName` y `customerPhone` desde el cliente; lo que mande el cuerpo para esos campos se ignora.
- La cita guarda `customerId`, `customerName` y `customerPhone` (copia del momento, para que el historial no cambie si el cliente edita sus datos después).
- Sin `customerId` se mantiene el comportamiento actual (`customerName` texto libre).
- `GET /appointments` y la reprogramación devuelven esos campos.

## 4. Agente

### Nueva herramienta `buscar_cliente`

```json
{ "name": "buscar_cliente", "arguments": { "query": "3001234567" } }
```

- `query` obligatorio (nombre o teléfono, ≤40).
- Devuelve `{ "ok": true, "data": { "count": 3, "customers": [{ "id", "name", "phone" }] } }`, máximo 10.

### `crear_cita` con cliente

- Nuevos argumentos opcionales: `customerPhone`, `customerName`.
- Si viene `customerPhone`: se normaliza, se busca un cliente con ese teléfono en el negocio; si existe se usa, si no se crea con `customerName` (o "Cliente" si no viene) y ese teléfono.
- La cita se crea con el `customerId` resultante.
- Si no viene `customerPhone`: comportamiento actual (texto libre en `customerName`).
- Error de validación del teléfono: `{ "ok": false, "error": "invalid_customer_phone" }` sin crear nada.

### Prompt

- Para reservar, pedir nombre y **teléfono** si el cliente no los dio.
- Usar `buscar_cliente` antes de crear cuando el cliente diga "ya he venido" o mencione un teléfono.
- No inventar datos del cliente ni reutilizar un teléfono de otro cliente.

## 5. Panel

### Menú Clientes (hoy es un aviso de "próximamente")

- Lista con buscador por nombre o teléfono, contador ("12 clientes"), estado vacío ("Aún no tienes clientes") y estado de error.
- Botón "Nuevo cliente"; al tocar uno se abre su ficha con datos e **historial de citas** (fecha, servicio, precio, estado), con estado vacío si no tiene.
- Editar y desactivar con confirmación; filtro "Ver inactivos".

### Agenda → Nueva cita

- Campo **Cliente** con buscador (nombre o teléfono): al elegir un cliente existente se vincula (`customerId`).
- Si no existe, escribir nombre y (opcional) teléfono: al guardar se crea el cliente y se vincula.
- Mantener la captura manual del nombre si el usuario no quiere crear ficha (opción "solo nombre").

### Detalle de cita

- Mostrar el nombre del cliente y marcar si es nuevo o recurrente (opcional, si la API lo permite sin consultas extra).

## 6. Criterios de aceptación

Pruebas unitarias: validaciones de cliente, normalización de teléfono, teléfono duplicado, herramienta `buscar_cliente`, `crear_cita` con teléfono creando/reutilizando cliente y con teléfono inválido.

Verificación end-to-end (extender `scripts/verify-slice.mjs`):

1. Crear cliente, buscarlo por nombre y por teléfono, editar, desactivar.
2. Teléfono duplicado → `409 customer_phone_taken`; teléfono inválido → `400`.
3. Crear cita con `customerId` → la cita guarda `customerId` y el nombre del cliente.
4. `GET /customers/:id` devuelve el historial con esa cita.
5. Cliente de otro negocio → `404`; B no ve los clientes de A.
6. Agente mock sigue creando citas sin romper.

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

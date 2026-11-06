# Corte: panel de plataforma (superadministrador de ALAIA)

**Objetivo:** que el dueño de ALAIA (tú) tenga su propio panel: ver los negocios registrados, su estado, plan y consumo, y poder suspender o reactivar. Es la puerta al cobro y al control.

**Fuera de alcance:** pasarela de pagos, facturación electrónica, invitaciones de trabajadores y límites automáticos por plan (se aplican después con los datos que este corte ya recoge).

## 1. Quién es administrador de plataforma

- Variable de entorno `PLATFORM_ADMIN_EMAILS`: lista de correos separada por comas (sin distinguir mayúsculas). Ejemplo: `PLATFORM_ADMIN_EMAILS=tu@correo.com`.
- Se compara con el `email` del token de Firebase del usuario autenticado.
- Middleware nuevo `requirePlatformAdmin`: 401 sin token; `403 not_platform_admin` si el correo no está en la lista.
- `GET /api/v1/me` (y `GET /tenants/:id/context` si aplica) incluye `isPlatformAdmin: true|false` para que el panel muestre u oculte la entrada.

Sin la variable configurada, **nadie es administrador**: el sistema sigue funcionando normal para los negocios.

## 2. Estado y plan del negocio

Campos nuevos en `tenants/{tenantId}`:

```json
{ "status": "active", "plan": "trial", "notes": "" }
```

- `status`: `"active"` (por defecto) o `"suspended"`.
- `plan`: `"trial"` (por defecto), `"basico"` o `"pro"`.
- `notes`: texto libre del administrador, ≤300.

**Efecto de la suspensión:** `requireTenantMembership` responde `403 tenant_suspended` a los miembros del negocio (dueño incluido) en todas las rutas del negocio. El administrador de plataforma sigue pudiendo leer y reactivar. El panel muestra "Tu cuenta está suspendida. Contacta a ALAIA." y no deja operar.

## 3. Consumo

En cada mensaje del agente se incrementa un contador del negocio (`tenants/{id}/usage/stats` o campo `usage` en el documento del tenant):

```json
{ "agentMessages": 128, "inputTokens": 15200, "outputTokens": 4100, "updatedAt": "<timestamp>" }
```

- Usar `FieldValue.increment` (no leer-modificar-escribir).
- `usage` de proveedores ya existe en los adaptadores; el mock devuelve ceros.
- Este dato es la base del cobro y de los topes futuros.

## 4. Rutas

Todas bajo `/api/v1/platform`, con `requirePlatformAdmin`.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/platform/summary` | `{ tenants: { total, active, suspended, trial }, appointmentsLast7Days, customersTotal, agentMessagesLast30Days }` |
| GET | `/platform/tenants?query=&status=` | `{ tenants: [{ tenantId, name, slug, sector, timeZone, createdAt, status, plan, ownerEmail, usage: {...}, counts: { appointments, customers, members } }] }` |
| GET | `/platform/tenants/:tenantId` | `{ tenant: { ...detalle, members: [...], recentActivity: [...] } }` |
| PATCH | `/platform/tenants/:tenantId` | `{ status?, plan?, notes? }` → `{ tenant }` |

- `query` busca por nombre, slug o correo del dueño.
- `status` filtra por `active` o `suspended`.
- Errores: `400 invalid_status`, `400 invalid_plan`, `400 invalid_notes`, `404 tenant_not_found`, `403 not_platform_admin`.
- Para `ownerEmail` y `members`: leer `memberships` del tenant y resolver el correo del usuario (una sola consulta por negocio, cacheada en memoria por request).

## 5. Panel

- Si `isPlatformAdmin`, aparece en el menú (o en el bloque de cuenta) la entrada **"Plataforma"**.
- **Resumen:** tarjetas con negocios totales, activos, suspendidos, en prueba, citas últimos 7 días, clientes y mensajes de IA de los últimos 30 días.
- **Negocios:** lista con nombre, sector, dueño (correo), plan, estado, citas, clientes y mensajes; buscador y filtro por estado.
- **Detalle:** datos del negocio, plan, notas y acciones: cambiar plan (trial/básico/pro), suspender/reactivar con confirmación y campo de notas.
- El administrador **no** entra a la agenda de los negocios (solo lectura de métricas): evitar malentendidos de propiedad de datos.
- Estados de carga, vacío, error y `403` claros. Todo en español, accesible y responsive.

## 6. Criterios de aceptación

Pruebas unitarias: validación de estado y plan, normalización de la lista de correos, cálculo de resumen con dobles.

Verificación end-to-end (extender `scripts/verify-slice.mjs`):

1. Sin `PLATFORM_ADMIN_EMAILS`, `GET /platform/tenants` → `403 not_platform_admin`.
2. Con el administrador configurado: `GET /me` trae `isPlatformAdmin: true`; `/platform/summary` y `/platform/tenants` responden.
3. `PATCH` plan → 200 y se refleja en el listado; plan inválido → `400`.
4. Suspender un negocio → sus rutas de negocio responden `403 tenant_suspended`; reactivar → vuelven a funcionar.
5. Un dueño normal no puede acceder al panel (`403`) ni suspender a otro negocio.
6. El panel muestra la entrada "Plataforma" solo para el administrador.

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

# Corte: perfil del negocio y resumen en el panel

**Objetivo:** que el dueño vea cómo va su negocio (citas, ingresos, clientes) y que su ficha pública tenga lo necesario: descripción, dirección, teléfono y redes sociales.

**Fuera de alcance:** trabajadores y comisiones (siguiente corte), página pública (después), subida de imágenes.

## 1. Perfil del negocio

Campos nuevos en `tenants/{tenantId}`:

```json
{
  "description": "Barbería con estilo, en el centro de Bogotá.",
  "address": "Calle 45 #12-30, Bogotá",
  "phone": "6012345678",
  "socialLinks": {
    "instagram": "https://instagram.com/barberia",
    "facebook": "",
    "tiktok": "",
    "whatsapp": "3001234567",
    "website": ""
  }
}
```

Validaciones:
- `description`: ≤300 → `invalid_description`.
- `address`: ≤200 → `invalid_address`.
- `phone`: ≤30, dígitos, espacios, `+`, `-` y paréntesis → `invalid_phone`.
- `socialLinks`: objeto con solo esas claves; cada valor ≤120. `instagram`, `facebook`, `tiktok` y `website` deben ser `https://...` o vacío → `invalid_social_link`. `whatsapp` acepta número (7–15 dígitos) o vacío → `invalid_social_link`.

`PATCH /api/v1/tenants/:tenantId` acepta además `description`, `address`, `phone` y `socialLinks` (solo dueño). `GET /context` y `GET /me/tenants` los devuelven.

## 2. Resumen del negocio

`GET /api/v1/tenants/:tenantId/dashboard?date=YYYY-MM-DD` (miembros).

- `date` opcional; por defecto hoy en la zona del negocio.
- Semana = lunes a domingo que contiene `date`; mes = mes calendario de `date`.

Respuesta:

```json
{
  "date": "2026-11-06",
  "timeZone": "America/Bogota",
  "appointments": { "today": 3, "week": 12, "month": 40, "cancelled": 2 },
  "income": { "today": 150000, "week": 620000, "month": 2150000 },
  "customers": { "total": 25, "newThisMonth": 6, "newLast30Days": 9 },
  "topServices": [{ "name": "Corte clásico", "count": 12, "income": 600000 }]
}
```

Reglas:
- Solo citas `scheduled` cuentan para ingresos; `cancelled` se cuenta aparte.
- Ingresos = suma de `priceCOP`.
- `topServices`: máximo 5, ordenado por ingresos descendente, del mes de `date`.
- Consultas acotadas al rango del mes; nada de leer toda la colección.

## 3. Panel

### Resumen (menú ya existe)
- Tarjetas: citas de hoy, de la semana, del mes; ingresos de hoy, semana y mes; clientes totales y nuevos del mes.
- Servicios top del mes con su ingreso.
- Selector de fecha si es simple; si no, mostrar siempre "hoy".
- Estados de carga, vacío y error.

### Configuración → Perfil del negocio
- Descripción, dirección, teléfono y redes (Instagram, Facebook, TikTok, WhatsApp, sitio web).
- Guardar con `PATCH /tenants/:id`, estados de éxito/error y validación visible.
- Vista previa simple de cómo se verá el encabezado público (sin construir la página pública todavía).

## 4. Criterios de aceptación

Unidades: validación de perfil y redes, cálculo del resumen con citas/clientes de prueba.

E2E (extender `scripts/verify-slice.mjs`):

1. `PATCH` perfil con redes válidas → 200 y `GET /context` lo devuelve.
2. Instagram sin `https://` → `400 invalid_social_link`.
3. `PATCH` con descripción de 301 → `400 invalid_description`.
4. Citas creadas hoy/semana/mes se reflejan en `dashboard` con los ingresos correctos.
5. Una cita cancelada no suma ingresos.
6. `dashboard` de un negocio ajeno → 404.

Cada capa termina con `npm --workspace @alaia/api run test`, `npm run verify`, `npm run build:web` y commit.

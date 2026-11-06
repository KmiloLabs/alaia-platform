# Estado actual del stack y del ecosistema

**Fecha:** 6 de noviembre de 2026. Complementa a `docs/arquitectura.md` (plan por capas): aquí va **qué está construido y funcionando hoy**, qué queda pendiente y qué herramientas se descartaron.

## 1. Piezas en uso

| Pieza | Qué hace | Estado |
|---|---|---|
| **Panel web** (Vite + JS) | Dueño, trabajador y tu panel de plataforma. Una sola app responsive | Listo |
| **API** (Node.js + Express) | Agenda, precios, permisos, agente, WhatsApp, plataforma | Listo |
| **Firestore** | Negocios, citas, clientes, servicios, conversaciones, consumo | Emulador local → proyecto Firebase real |
| **Firebase Auth** | Login con correo/contraseña y Google | Emulador local → proyecto real |
| **DeepSeek** | Cerebro del agente: entiende y decide qué herramienta usar | Activo con clave real |
| **WhatsApp Cloud API** | Canal del cliente final | Código listo; falta registrar el número en Meta |
| **Firebase Hosting** | Panel en internet | Pendiente de desplegar |
| **Hosting de la API** | Backend en internet | Pendiente (Render gratis → Cloud Run) |
| **Dominio** | `alaia.app` o el nombre elegido | Se compra cuando funcione |

## 2. Flujos

**Reserva por WhatsApp:**
1. El cliente escribe al número del negocio.
2. Meta entrega el mensaje al webhook con el `phone_number_id`.
3. La API resuelve el negocio por ese número (no por el teléfono del cliente).
4. Crea/reutiliza el cliente y llama al agente.
5. El agente usa herramientas contra la misma agenda del panel.
6. La respuesta sale por Graph API.

**Reserva por página pública:**
`dominio.com/b/<slug>` → servicios, equipo y horarios reales → reserva → misma agenda.

**Dueño:** agenda, clientes, servicios, equipo, comisiones, resumen, configuración del agente y página pública.

## 3. Herramientas descartadas

| Herramienta | Por qué no |
|---|---|
| **n8n** | Fue el piloto del recepcionista; el agente ya vive en nuestra API con herramientas auditables. No es autoridad de reservas ni pagos. Opcional a futuro solo para automatizaciones auxiliares. |
| **Electron** | No hay app de escritorio: el panel es web responsive (celular y PC). |
| **Cloudflare** | No es obligatorio. Útil como DNS/CDN o túnel al comprar el dominio; no forma parte de la lógica. |
| **Microservicios / Kubernetes** | Innecesarios para un piloto; más costo y complejidad. |
| **Hosting compartido / WordPress** | No soporta Node + Firestore + webhooks. |

## 4. Dos entornos

**Local (hoy):** API en 3001, panel en 5173, emuladores de Firebase. Datos de prueba temporales. WhatsApp en `sandbox` (no envía).

**Producción:** API en hosting gratuito o Cloud Run, panel en Firebase Hosting, Firestore/Auth reales, WhatsApp en `live`.

El mismo código sirve en ambos: solo cambian variables de configuración.

## 5. Decisiones abiertas

1. Hosting de la API: Render gratis (se duerme) vs Cloud Run (requiere prepago de Google).
2. Dominio: cuándo comprarlo y dónde.
3. Pagos: Wompi, cuando haya planes cobrándose.
4. Google Calendar: integración opcional; la agenda de Alaia es la fuente de verdad.
5. Recordatorios: envío programado por WhatsApp en modo `live`.

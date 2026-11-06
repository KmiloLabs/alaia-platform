# Arquitectura del ecosistema Alaia

**Fecha:** 6 de noviembre de 2026. Documento de referencia: qué usa Alaia, qué no usa y por qué.

## 1. Las piezas y su responsabilidad

| Pieza | Qué hace | Estado |
|---|---|---|
| **Panel web** (Vite + JS) | Lo que ven dueño, trabajador y tu panel de plataforma. Una sola app responsive | En producción local; listo para desplegar |
| **API** (Node.js + Express) | Reglas del negocio: agenda, precios, permisos, agente, WhatsApp | Local; lista para desplegar |
| **Firestore** | Base de datos: negocios, citas, clientes, servicios, conversaciones | Emulador local → proyecto Firebase real |
| **Firebase Auth** | Login con correo/contraseña y Google | Emulador local → proyecto real |
| **DeepSeek** | El "cerebro" del agente: entiende al cliente y decide qué herramienta usar | Activo (API key real) |
| **WhatsApp Cloud API** (Meta) | Canal por donde escribe el cliente final | Código listo; falta registrar el número en Meta |
| **Firebase Hosting** | Sirve el panel en internet | Pendiente de desplegar |
| **Hosting de la API** | Corre el backend en internet (Render gratuito hoy; Cloud Run cuando haya clientes) | Pendiente de desplegar |
| **Dominio** | Dirección tipo `alaia.app` | Se compra cuando el sistema funcione |

## 2. Cómo fluye una reserva

**Por WhatsApp (canal principal):**

1. El cliente escribe al número del negocio.
2. Meta entrega el mensaje al **webhook** de Alaia con el `phone_number_id`.
3. La API busca ese número en `whatsappNumbers` y sabe de qué negocio es.
4. Crea/reutiliza el cliente por teléfono y llama al **agente**.
5. El agente usa herramientas (servicios, disponibilidad, crear cita) contra la misma agenda del panel.
6. La API responde por Graph API y el cliente recibe el mensaje.

**Por la página pública:**

1. El cliente abre `tu-dominio.com/b/nombre-del-negocio`.
2. Ve servicios, precios, equipo y horarios reales.
3. Reserva; la cita entra a la misma agenda.

**El dueño:**
- Ve todo en el panel (agenda, clientes, servicios, equipo, comisiones, resumen).
- Puede probar el agente desde Configuración y el canal de WhatsApp en modo prueba.

## 3. Qué NO usamos y por qué

| Herramienta | Por qué no |
|---|---|
| **n8n** | Fue un piloto (el workflow del recepcionista). El agente ya vive en nuestra API, con herramientas auditables. n8n no es la autoridad de reservas ni pagos. Solo podría usarse más adelante para automatizaciones auxiliares (avisos externos), y es opcional. |
| **Electron** | Electron sirve para empaquetar una app de escritorio. Alaia es web responsive: el trabajador entra desde el navegador del celular. Una app de escritorio duplicaría trabajo sin aportar nada. |
| **Cloudflare** | No es obligatorio. Sirve como DNS/CDN o para túneles. Se puede usar al comprar el dominio (DNS gratis y rápido) o para exponer un servidor local mientras no haya despliegue. No es parte de la lógica del producto. |
| **Microservicios / Kubernetes** | Con un piloto no se justifican: más costo, más complejidad, más cosas que se rompen. |
| **WordPress / hosting compartido** | No soporta este stack (Node + Firestore + webhooks). |

## 4. Dos entornos

**Local (desarrollo, hoy):**
- API en `localhost:3001`, panel en `localhost:5173`, emuladores de Firebase en la máquina.
- Datos de prueba temporales.
- WhatsApp en modo `sandbox`: todo el flujo corre, pero no envía a Meta.

**Producción (cuando despleguemos):**
- API en hosting gratuito (Render) o Cloud Run.
- Panel en Firebase Hosting.
- Firestore y Auth reales del proyecto "Alaia".
- WhatsApp en modo `live` con el número registrado en Meta.

El mismo código sirve en los dos entornos: solo cambian variables de configuración.

## 5. Decisiones todavía abiertas

1. **Hosting de la API:** Render gratuito (se duerme) vs Cloud Run (requiere el prepago de Google).
2. **Dominio:** cuándo comprarlo y con qué proveedor (Cloudflare/Namecheap/Hostinger).
3. **Pagos:** Wompi como recomendación, cuando haya planes cobrándose.
4. **Google Calendar:** integración opcional futura; la agenda de Alaia es la fuente de verdad.
5. **Recordatorios:** envío programado por WhatsApp; requiere el canal en modo `live` y algún disparador (cron o tarea programada).

## 6. Principios

- Una sola plataforma multi-negocio, no una instalación por cliente.
- La IA no es la autoridad: reserva, precios y permisos los decide el backend.
- Si una integración falla (Meta, Google Calendar), la agenda interna no se corrompe.
- Cada capa se prueba (unitarias + end-to-end) y se sube a GitHub antes de seguir.
- No se reescribe por moda: se adopta lo que resuelve un problema real.

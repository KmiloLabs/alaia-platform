# Paso a paso: WhatsApp real para Alaia (Meta Cloud API)

**Objetivo:** que la barbería reciba mensajes reales en un número propio, con el agente y los recordatorios funcionando.
**Realidad de Alaia hoy:** el código ya está listo y desplegado. Lo que falta es registrar el número en Meta (trámite, no programación).

---

## Ruta exprés — número de prueba de Meta (probar hoy, sin chip)

Meta regala un **número de prueba** dentro de la app. Sirve para probar todo el canal sin chip, sin verificación de empresa y sin costo.

1. App → **WhatsApp → Configuración de la API**.
2. Copia:
   - **phone_number_id** del número de prueba (aparece debajo del número)
   - **token de acceso temporal** (vence en 24 h; solo para probar hoy)
3. Agrega destinatarios: en **Para / To** → *Administrar lista de números* → agrega tu celular → recibes un código por WhatsApp → verifícalo (máximo 5 números).
4. Configura el **webhook** (igual que la Fase 5): URL `https://alaia-ophy.onrender.com/api/v1/webhooks/whatsapp`, token de verificación y suscribir `messages`.
5. En Render → Environment:
   - `WHATSAPP_MODE` = `live`
   - `WHATSAPP_TOKEN` = token temporal
   - `WHATSAPP_VERIFY_TOKEN` = cadena aleatoria larga
   - `WHATSAPP_APP_SECRET` = App Secret de la Fase 1
6. En el panel de Alaia: consola de plataforma → crea el negocio **Pruebas Kmilo** → sección **WhatsApp** → pega el **phone_number_id**.
7. Desde tu celular (el que verificaste) escribe `hola` al número de prueba.
8. Revisa en el panel: la conversación debe aparecer en la bandeja y el agente debe responder.

**Para Araan (la barbería real)** se repite lo mismo pero con su número, un **token permanente** (Fase 3) y la verificación de empresa (Fase 4).

---

## Fase 0 — Antes de tocar Meta (30 min)

- [ ] **Chip nuevo** para la barbería (prepago, Colombia). **No** usar el número de NOVARA (+57 320 7413254) ni tu número personal.
- [ ] El chip **no debe tener WhatsApp activo**. Si lo tiene: WhatsApp → Ajustes → Cuenta → Eliminar mi cuenta.
- [ ] Ten a mano: nombre comercial de la barbería, NIT o cédula, dirección, correo del negocio, Instagram o sitio web.
- [ ] Entra a **business.facebook.com** y crea (o usa) un **Administrador comercial** con el correo del negocio, no con tu correo personal.

> Si el negocio no tiene aún NIT/cámara de comercio, se puede empezar igual como persona natural con cédula.

---

## Fase 1 — Crear la app en Meta (20 min)

1. **developers.facebook.com** → Mis apps → **Crear app**.
2. Nombre: `Alaia`. Caso de uso: **Empresa**.
3. En el panel de la app: **Agregar producto → WhatsApp → Configurar**.
4. En **Configuración → Básica**, llena:
   - URL de privacidad: `https://alaia-ophy.onrender.com/legal/privacidad`
   - URL de eliminación de datos: `https://alaia-ophy.onrender.com/legal/borrado-datos`
   - Correo de contacto y categoría (Servicios de tecnología).
5. **Captura estos dos datos (sin compartirlos por chat):**
   - **App ID**
   - **App Secret** → va luego en Render como `WHATSAPP_APP_SECRET`

---

## Fase 2 — Registrar el número (15 min)

1. WhatsApp → **Comenzar** → **Agregar número de teléfono**.
2. Nombre para mostrar: el de la barbería (máximo 20 caracteres, sin genéricos como "info").
3. Número: el chip nuevo. Verifica por **SMS o llamada**.
4. **Captura:**
   - **phone_number_id** (identificador de número de teléfono)
   - **WABA ID** (identificador de la cuenta de WhatsApp Business)

---

## Fase 3 — Token permanente (10 min)

1. business.facebook.com → **Usuarios → Usuarios del sistema → Agregar**.
2. Nombre: `alaia-bot`. Rol: **Administrador**.
3. **Asignar activos:** la app `Alaia` (control total) y la cuenta de WhatsApp Business.
4. **Generar token** con permisos:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Guárdalo en un lugar seguro (gestor de contraseñas o archivo local fuera de Git). **Nunca en el chat ni en el repositorio.**

---

## Fase 4 — Verificación de empresa (1–3 días hábiles) ⏱️

1. business.facebook.com → **Configuración del negocio → Verificación de la empresa**.
2. Sube: RUT o cámara de comercio (o cédula si es persona natural) + comprobante de dirección (recibo de servicios).
3. Espera la revisión.

**Mientras esperas, no estás bloqueado:** en modo desarrollo Meta permite escribir a **5 números de prueba** que autorices. Con eso ya puedes hacer el piloto con la barbería.

---

## Fase 5 — Webhook (15 min)

1. App → WhatsApp → **Configuración → Webhook → Editar**.
2. URL de devolución de llamada:
   `https://alaia-ophy.onrender.com/api/v1/webhooks/whatsapp`
3. Token de verificación: el valor que pongas en Render como `WHATSAPP_VERIFY_TOKEN` (genera una cadena larga aleatoria; no uses `alaia-verify-token`).
4. **Verificar y guardar** → debe quedar en "verificado".
5. **Suscribir** el campo `messages`.

---

## Fase 6 — Conectar en Alaia y pasar a live (15 min)

1. En Render → servicio `alaia` → **Environment**, asegura estas variables:

| Variable | Valor |
|---|---|
| `WHATSAPP_MODE` | `live` (después de probar en sandbox) |
| `WHATSAPP_APP_SECRET` | App Secret de la Fase 1 |
| `WHATSAPP_VERIFY_TOKEN` | El token de la Fase 5 |
| `CRON_SECRET` | Cadena aleatoria larga (para recordatorios) |

2. Panel de plataforma → Negocios → la barbería → **WhatsApp → Conectar** → pega el **phone_number_id**.
3. Reinicia el servicio (Render lo hace al guardar variables).
4. Prueba: `https://alaia-ophy.onrender.com/health` → `{"status":"ok"}`.

---

## Fase 7 — Recordatorios automáticos (10 min)

El endpoint existe: `POST /api/v1/tasks/reminders/run` con cabecera `x-cron-secret`.

- [ ] Crear una tarea gratis en **cron-job.org** (o Render Cron Job) que llame esa URL **cada 10 minutos**.
- [ ] En el panel de la barbería: activar recordatorios y definir horas antes (24 h y 2 h por defecto).

**⚠️ Límite real de Meta:** el código hoy envía los recordatorios como **texto libre**. Meta solo permite texto libre dentro de las **24 h** desde el último mensaje del cliente. Para recordar una cita de mañana hay que usar una **plantilla aprobada**.
Por eso, en paralelo:

- [ ] WhatsApp → **Plantillas → Crear**: nombre `recordatorio_cita`, categoría **Utilidad**, idioma **es_CO**.
      Cuerpo: `Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. Responde SI para confirmar.`
- [ ] Enviar a revisión (1–3 días).

> El envío por plantilla es un cambio de código pequeño que hago yo cuando la plantilla esté aprobada. Hoy no bloquea el piloto.

---

## Fase 8 — Prueba de aceptación (30 min)

Con el chip nuevo, desde uno de los 5 números autorizados:

- [ ] Escribir "hola" → el agente responde el saludo.
- [ ] Preguntar "¿qué servicios tienen?" → responde con servicios reales del panel.
- [ ] Pedir cita → el agente consulta disponibilidad real y agenda.
- [ ] Revisar en el panel: conversación en la bandeja + cita creada.
- [ ] **Pausar la IA** desde la bandeja y responder como humano.
- [ ] Verificar que el aviso de privacidad se envió una sola vez.

Si los 6 pasan, el canal está listo para el piloto con clientes reales de la barbería.

---

## Qué NO compartir nunca por chat

`App Secret`, token permanente, `CRON_SECRET`, JSON de la cuenta de servicio de Firebase y contraseñas. Se cargan directo en Render o en el panel, nunca en la conversación ni en Git.

---

## Costos de Meta (referencia)

- Las pruebas a los 5 números autorizados son **gratis**.
- Con la empresa verificada, Meta cobra **por conversación** según su tarifa vigente (centavos de dólar). Verifica la tarifa del día en la consola de Meta antes de escalar; para un piloto de una barbería el gasto es mínimo.

---

## Lo que queda de mi lado (código)

1. Enviar recordatorios por **plantilla** cuando la cita esté fuera de 24 h.
2. Mensaje de rechazo amable para **audios** entrantes (hoy se ignoran): "por ahora escríbeme, ya te leo en audio".
3. (Opcional) plantilla de **bienvenida** para iniciar conversación con un cliente que nunca ha escrito.

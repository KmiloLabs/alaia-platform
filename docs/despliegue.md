# Despliegue de Alaia

**Estrategia:** un solo servicio en internet que sirve **el panel y la API** en el mismo dominio. Sin CORS cruzado y sin configurar dos servicios.

## 1. Qué se despliega

- Un servicio Node en **Render (plan gratuito)**.
- Sirve:
  - el panel compilado (`apps/web/dist`) en `/`,
  - la API en `/api/v1`,
  - el webhook de WhatsApp en `/api/v1/webhooks/whatsapp`.
- Base de datos y login: **Firebase real del proyecto `alaia-3f637`** (ya conectado y probado).

El plan gratuito de Render duerme el servicio tras ~15 minutos sin uso: la primera visita puede tardar 30–60 segundos. Suficiente para el piloto.

## 2. Requisitos

1. Cuenta en **render.com** (gratis, con GitHub).
2. El repositorio de Alaia en GitHub (`KmiloLabs/alaia-platform`).
3. El JSON de la **cuenta de servicio** de Firebase (Configuración → Cuentas de servicio).
4. Los datos de la **app web** de Firebase (públicos).

## 3. Pasos en Render

1. Entra a render.com → **New → Web Service** → conecta el repositorio de Alaia.
2. Configuración:
   - **Name:** alaia
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build:web`
   - **Start Command:** `node apps/api/src/server.js`
   - **Plan:** Free
   - **Health Check Path:** `/health`
3. En **Environment Variables**, pega:

| Variable | Valor |
|---|---|
| `FIREBASE_PROJECT_ID` | `alaia-3f637` |
| `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | La cuenta de servicio en **base64** (una sola línea; generarla con `scripts/` o base64 del JSON) |
| `VITE_FIREBASE_API_KEY` | La del `firebaseConfig` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `alaia-3f637.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `alaia-3f637` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `alaia-3f637.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | La del `firebaseConfig` |
| `VITE_FIREBASE_APP_ID` | La del `firebaseConfig` |
| `DEEPSEEK_API_KEY` | La clave de DeepSeek |
| `PLATFORM_ADMIN_EMAILS` | `automatizacionsaas@gmail.com` |
| `PLATFORM_SECRET` | 64 caracteres hex (generar) |
| `CRON_SECRET` | Secreto para recordatorios (generar) |
| `AGENT_ENABLE_MOCK` | `false` |
| `WHATSAPP_MODE` | `sandbox` (por ahora) |

4. **Create Web Service** y espera el deploy (3–5 minutos).
5. Abre la URL que da Render: debe cargar el panel y permitir login con la cuenta real.

## 4. Verificación

1. `https://<servicio>.onrender.com/health` → `{"status":"ok"}`.
2. Login con el correo del dueño → aparece el negocio.
3. Crear un servicio y una cita → recargar la página → siguen ahí (Firestore real).

## 5. WhatsApp

- URL del webhook para Meta: `https://<servicio>.onrender.com/api/v1/webhooks/whatsapp`.
- Verify token: el valor de `WHATSAPP_VERIFY_TOKEN`.
- Cuando el número esté registrado en Meta, cambiar `WHATSAPP_MODE` a `live` y reiniciar el servicio.

## 6. Dominio propio (después)

1. Comprar el dominio.
2. En Render: **Settings → Custom Domain** → agregar dominio.
3. Crear el registro DNS que indica Render (CNAME).
4. El certificado HTTPS lo gestiona Render.

## 7. Cuándo migrar a Google Cloud

Cuando haya clientes pagando y el arranque en frío moleste:

- Activar facturación (prepago de Google Colombia, queda como saldo).
- Mover la API a Cloud Run y el panel a Firebase Hosting.
- El código ya soporta los dos entornos cambiando variables.

## 8. Secretos

- `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` (y su variante en JSON) da acceso total a la base: solo en variables de entorno, nunca en Git.
- Si una clave se expone, rotarla y actualizar la variable.
- `.env` y `.env.real` están ignorados por Git.

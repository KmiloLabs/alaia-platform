# Guía de despliegue (puente gratuito)

Objetivo: sacar Alaia del emulador local a internet sin pagar, con Firebase (plan Spark) y un hosting gratuito para la API. Cuando haya clientes pagando se cambia a Google Cloud (Cloud Run) sin reescribir nada.

## 1. Firebase (plan Spark, sin tarjeta)

1. console.firebase.google.com → **Agregar proyecto** → proyecto de Google Cloud existente (el de Alaia, no el de Selene).
2. Plan **Spark**.
3. Activar:
   - **Firestore Database** → crear base de datos → modo producción.
   - **Authentication** → Correo electrónico/contraseña y Google.
   - **Hosting** (se usa al final).
4. Crear una **app web** (Configuración → Tus apps → Web) y copiar `firebaseConfig` (son datos públicos).

## 2. Credenciales del servidor (API)

Firebase → Configuración del proyecto → **Cuentas de servicio** → **Generar nueva clave privada**. Descarga un `.json`.

- Guardarlo fuera del repositorio, por ejemplo `C:\Users\Usuario\Downloads\alaia-secrets\service-account.json`.
- Nunca subirlo a Git ni pegarlo en el chat.

Variables de la API para el proyecto real (en `.env`):

```
FIREBASE_PROJECT_ID=<id-del-proyecto>
GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\service-account.json
# y quitar/no definir:
# FIREBASE_AUTH_EMULATOR_HOST
# FIRESTORE_EMULATOR_HOST
```

## 3. Panel (variables de build)

En `.env` (o en el proveedor de hosting), para que el panel use el proyecto real:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_URL=https://<api-publica>
```

Sin `VITE_FIREBASE_API_KEY`, el panel sigue usando el emulador local (modo desarrollo).

## 4. API en hosting gratuito

Opciones sin tarjeta: Render (nivel gratuito) u otro PaaS equivalente.

- Repo: GitHub de Alaia; comando de arranque `npm --workspace @alaia/api run start`.
- Variables: las de la sección 2, más las del agente (`DEEPSEEK_API_KEY`, etc.) y las del canal (`WHATSAPP_*`).
- Limitación del plan gratis: el servicio se duerme tras inactividad (primera visita lenta).

## 5. WhatsApp

- La URL del webhook debe ser pública: `https://<api-publica>/api/v1/webhooks/whatsapp`.
- En Meta: WhatsApp → Configuración → Webhook: pegar la URL y el `WHATSAPP_VERIFY_TOKEN`.
- Suscribir el campo `messages`.
- En el panel de plataforma: conectar el `phone_number_id` del negocio.

## 6. Orden de trabajo

1. Proyecto Firebase real y credenciales.
2. Probar la API local contra Firestore real (sin emulador).
3. Desplegar la API.
4. Desplegar el panel (Firebase Hosting) apuntando a la API.
5. Webhook de WhatsApp y prueba real.
6. Dominio propio (cuando el sistema funcione).

## 7. Notas de seguridad

- El service account JSON da acceso total a la base: tratarlo como una contraseña.
- El panel no habla con Firestore directamente: todo pasa por la API (las reglas de Firestore pueden quedar cerradas).
- Rotar claves si alguna se expone; el token de WhatsApp temporal vence en 24 h.

# Pasar WhatsApp de sandbox a live (guía simple)

**Para quién:** el dueño del negocio o el administrador de Alaia. Sin tecnicismos.
**Tiempo estimado:** 2–4 días (la verificación de empresa de Meta es la que más tarda).

## Antes de empezar

- El número debe estar **libre**: si tiene WhatsApp normal activo, hay que eliminarlo primero (Ajustes → Cuenta → Eliminar cuenta).
- Tener a mano: nombre comercial, NIT o cédula (si es persona natural), dirección, correo y sitio web o red social del negocio.
- URLs de Alaia que Meta pide:
  - Privacidad: `https://alaia-ophy.onrender.com/legal/privacidad`
  - Eliminación de datos: `https://alaia-ophy.onrender.com/legal/borrado-datos`

## Parte 1 — Crear la app en Meta (una sola vez, la hace Alaia)

1. Entrar a **developers.facebook.com** con la cuenta de Facebook del negocio.
2. **Mis apps → Crear app**.
3. Nombre: "Alaia". Tipo: **Empresa**.
4. En el panel de la app: **Agregar producto → WhatsApp → Configurar**.
5. En **Configuración → Básica**:
   - URL de privacidad: la de Alaia.
   - Correo de contacto.
   - Categoría: "Servicios de tecnología" o similar.

## Parte 2 — Registrar el número

1. WhatsApp → **Comenzar** → **Agregar número de teléfono**.
2. Nombre para mostrar: el del negocio.
3. Número: +57 300 003 4255.
4. Verificar con el código que llega por **SMS o llamada**.
5. Copiar y guardar:
   - **Identificador de número de teléfono** (phone_number_id)
   - **Identificador de la cuenta de WhatsApp Business** (WABA ID)

## Parte 3 — Verificar la empresa (para clientes reales)

1. Entrar a **business.facebook.com** → **Configuración del negocio**.
2. **Verificación de la empresa** → iniciar.
3. Subir documentos: RUT o cámara de comercio (según el caso) y comprobante de dirección.
4. Esperar la revisión (1–3 días hábiles).

**Sin esta verificación**, Meta solo permite escribir a **5 números de prueba** que tú autorices. Con ella, se puede escribir a cualquier cliente que haya escrito primero.

## Parte 4 — Token permanente

1. business.facebook.com → **Usuarios → Usuarios del sistema → Agregar**.
2. Nombre: "alaia-bot". Rol: Administrador.
3. **Asignar activos → Apps → Alaia** (control total).
4. **Generar token** → elegir la app → permisos:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Copiar el token y guardarlo como secreto. **No se comparte por chat.**

## Parte 5 — Webhook

1. En la app: WhatsApp → **Configuración → Webhook → Editar**.
2. URL de devolución de llamada: `https://alaia-ophy.onrender.com/api/v1/webhooks/whatsapp`
3. Token de verificación: `alaia-verify-token`
4. **Verificar y guardar**. Debe quedar "verificado".
5. **Suscribir** el campo `messages`.

## Parte 6 — Conectar en Alaia

1. Entrar al panel de plataforma (cuenta admin).
2. Negocios → el negocio → **WhatsApp** → **Conectar**.
3. Pegar el **phone_number_id**.
4. En Render, cambiar `WHATSAPP_MODE` de `sandbox` a `live` y guardar (el servicio se reinicia).
5. Probar desde un celular autorizado (uno de los 5 números si aún no hay verificación).

## Parte 7 — Plantillas para recordatorios

Los recordatorios que el negocio inicia **fuera de la ventana de 24 h** necesitan una **plantilla aprobada** por Meta.

1. WhatsApp → **Plantillas de mensajes → Crear plantilla**.
2. Categoría: **Utilidad**.
3. Nombre: `recordatorio_cita`.
4. Idioma: español (Colombia).
5. Cuerpo:

```
Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. Responde SI para confirmar.
```

6. Enviar a revisión (normalmente 1–3 días).

Mientras la plantilla no esté aprobada, los recordatorios solo se entregan si el cliente escribió en las últimas 24 h.

## Errores comunes

| Mensaje | Causa | Solución |
|---|---|---|
| "El número ya está registrado en WhatsApp" | El número tiene WhatsApp normal | Eliminar esa cuenta o usar otro número |
| "No se pudo verificar el webhook" | Token distinto al configurado | Revisar `WHATSAPP_VERIFY_TOKEN` en Render |
| 401 `invalid_signature` | App Secret incorrecto | Revisar `WHATSAPP_APP_SECRET` |
| "Recipient not in allowed list" | Falta verificación de empresa | Verificar la empresa en Meta |
| Los recordatorios no llegan | Fuera de 24 h sin plantilla | Crear y aprobar la plantilla |

## Después de la prueba

1. Confirmar con 3 mensajes reales: saludo, consulta de servicios y agendar una cita.
2. Revisar en el panel: conversación, cita creada, aviso de privacidad enviado una vez.
3. Probar la coexistencia: pausar la IA y responder como persona.
4. Recién ahí activar el cobro y cerrar el piloto.

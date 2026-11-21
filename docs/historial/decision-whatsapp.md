# Decisión: qué canal de WhatsApp usar en Alaia

**Fecha:** 6 de noviembre de 2026 · **Estado:** recomendación para aprobar.

## Resumen

- **Alaia (SaaS multi-negocio):** WhatsApp Cloud API oficial de Meta.
- **Selene / LUNA MÍSTICA (un solo negocio, ya funcionando):** Evolution API, como está hoy. No se migra.

La razón no es técnica sino de riesgo: con Evolution se opera un número a través del protocolo no oficial de WhatsApp Web; con Cloud API se opera por el canal oficial. Para un producto que va a **pautar, enviar recordatorios y atender a muchos negocios**, el riesgo de bloqueo del número con Evolution es inaceptable.

## Comparación

| Criterio | Evolution API (no oficial) | WhatsApp Cloud API (oficial) |
|---|---|---|
| Riesgo de baneo | Alto, sobre todo con envíos masivos o números nuevos | Bajo si se cumple la política (opt-in, plantillas, sin spam) |
| Pauta / campañas | No permitido por los términos; riesgo real de bloqueo | Permitido con plantillas aprobadas y opt-in; se puede usar clic-a-WhatsApp desde Meta Ads |
| Multi-negocio | Una instancia por número; complica operar decenas de negocios | Diseñada para SaaS: cada negocio conecta su número con Embedded Signup |
| Verificación de webhooks | Propia, sin firma estándar de Meta | Firma `X-Hub-Signature-256` verificable |
| Costo | Servidor propio (VPS) | Cobro por conversación de Meta (varía por país y categoría) |
| Operación | Hay que mantener la sesión viva, QR, reconexiones | Meta gestiona la sesión; menos mantenimiento |
| Onboarding del negocio | Manual, una por una | El dueño conecta su número desde Alaia (Embedded Signup) |
| Encaja con la arquitectura | mal | bien |

## Por qué Evolution no sirve para Alaia

1. **Un número por instancia:** cada negocio necesitaría su propio contenedor y su propio mantenimiento. Con 20 negocios eso es 20 instancias.
2. **Riesgo de baneo:** el protocolo no oficial no está autorizado para uso comercial masivo. Un cliente que hace una campaña puede perder su número y culpar a Alaia.
3. **Pauta:** para anuncios que llevan a WhatsApp se necesita número oficial; con Evolution el riesgo de bloqueo es alto y no hay recurso formal ante Meta.
4. **Sin firmas de webhook estándar:** la verificación de que el mensaje viene de Meta hay que hacerla a mano.

## Cómo funciona la Cloud API en un SaaS

1. Alaia tiene **una app de Meta** (Business) y un webhook propio: `https://api.alaia.../webhooks/whatsapp`.
2. Cada negocio, desde el panel, pulsa "Conectar WhatsApp" y pasa por **Embedded Signup**: autoriza a Alaia a operar su número.
3. Meta devuelve el `phone_number_id` de ese negocio. Alaia lo guarda en `tenants/{tenantId}/integrations/whatsapp` (referencia segura, nunca el token en claro en Firestore).
4. Los mensajes entrantes llegan todos al mismo webhook; el backend mira el `phone_number_id` receptor, resuelve el tenant y procesa.
5. Los tokens de cada negocio se guardan cifrados o en un almacén de secretos; se rotan y se pueden revocar.
6. Para mensajes fuera de la ventana de 24 h o para campañas: **plantillas aprobadas por Meta** y opt-in registrado. Para publicidad: anuncios de Meta con botón "Enviar mensaje".

## Lo que hay que decidir antes de implementar

- **Alta como negocio en Meta:** la app de Alaia necesita verificación de negocio, política de privacidad pública y revisión para `whatsapp_business_messaging`.
- **Costo:** Meta cobra por conversación; hay que definir si Alaia lo incluye en el plan o lo pasa al cliente.
- **Proveedor de integración (BSP):** se puede ir directo con Meta (más barato, más trabajo) o con un BSP tipo 360dialog o Twilio (onboarding más simple, costo mayor). Recomendación: empezar directo con Meta si el volumen es bajo; BSP si se quiere acelerar el alta de clientes.
- **Datos personales:** registrar consentimiento y política de privacidad antes de pautar (obligación en Colombia).

## Mientras tanto (esta etapa)

El agente ya funciona **sin WhatsApp**: se prueba desde Configuración → Asistente IA y por API (`POST /agent/messages`). Así validamos conversación, herramientas y agenda sin depender de Meta.

## Impacto en el código actual

- La entrada por WhatsApp será un **adaptador** (`channel`), no un cambio del agente ni de la agenda.
- El agente y las herramientas no saben de qué canal vienen los mensajes: reciben `tenantId` y un mensaje.
- El mapa `phone_number_id → tenantId` vive en Firestore; el webhook verifica firma, deduplica el `messageId` y responde 200 rápido, procesando fuera de la petición.

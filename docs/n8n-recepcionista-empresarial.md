# Flujo auxiliar de recepción empresarial (n8n)

**Estado al 5 de noviembre de 2026:** borrador creado y validado en n8n; permanece inactivo. No atiende conversaciones reales.

## Qué se creó

- Workflow `ALAIA - Recepcionista empresarial (borrador)`; ID `p2AClhoHBEgTig4C`.
- Ocho nodos: entrada webhook, validación del contrato interno, enrutamiento y cinco salidas estructuradas.
- Intenciones previstas: solicitar cita, consultar producto, pedir información pública, pasar a una persona o pedir aclaración.
- Validación estricta de n8n: cero errores, siete conexiones válidas. Persisten avisos genéricos de tratamiento de errores que deben resolverse antes de activar.
- No usa credenciales ni modelos de IA; no se conecta a Novara, clientes, WhatsApp, Firebase ni API de Alaia. No realiza reservas, ventas ni envía respuestas.

## Cómo encaja en Alaia

La API propia debe recibir y autenticar el evento del canal, verificar la firma del proveedor, deduplicar el mensaje y resolver el negocio por una asociación confiable. Solo después puede enviar un evento interno mínimo a n8n. El `tenantId` del evento debe venir de esa resolución del servidor; nunca se acepta como autoridad desde el texto, el navegador o una herramienta de IA.

n8n propone una acción estructurada. La API de Alaia debe volver a comprobar membresía/contexto, disponibilidad, inventario y permisos antes de ejecutar cualquier cambio. La agenda central de Alaia seguirá siendo la fuente de verdad. La conexión interna necesita autenticación por secreto y una política de errores/respuesta antes de cualquier activación.

## Contrato interno previsto

Campos mínimos: `eventId`, `tenantId` ya resuelto por backend, `channel` (`whatsapp` o `webchat`), `customerRef` seudónimo, `messageId`, `text` limitado e `intent` clasificada. `customerStatus` puede ser `new`, `returning` o `unknown`; no es una fuente independiente de verdad y debe provenir de consulta autorizada al backend.

El flujo limita longitudes y rechaza canales desconocidos. Este contrato es provisional; no es una API pública ni debe exponerse directamente a clientes.

## Próximo orden de trabajo

1. Completar la capa backend de negocio: servicios, profesionales, horarios y disponibilidad con autorización por tenant.
2. Implementar creación de cita con validación de disponibilidad, prevención de doble reserva e idempotencia.
3. Definir herramientas internas estrechas para n8n: consulta de información pública, disponibilidad, propuesta/confirmación de cita y derivación humana.
4. Añadir historial mínimo de cliente y clasificación nuevo/recurrente mediante el backend, con reglas de acceso y retención.
5. Conectar y ensayar el flujo con datos ficticios en `demo-alaia`; luego integrar un modelo de IA mediante adaptador reemplazable.
6. Añadir WhatsApp después de configurar y verificar la integración, consentimiento, seguridad y costos. Activar solo tras revisión de errores, pruebas de aislamiento e idempotencia.

El inventario y las ventas entran después de que exista catálogo e inventario en el backend; no se debe declarar stock ni registrar ventas desde este flujo por sí solo.

## Límites operativos

- No activar este workflow hasta que el webhook esté autenticado y el API receptor esté disponible.
- No guardar cuerpos completos de conversación en registros de ejecución; el workflow tiene guardado de ejecuciones deshabilitado.
- No poner credenciales de clientes en parámetros visibles ni permitir que clientes editen el workflow.
- Mantener la lógica crítica y los permisos en el backend. Revisar las condiciones de licencia de n8n antes de ofrecer funciones que expongan o revendan su editor/servicio; la modalidad exacta requiere confirmar con [los términos oficiales de n8n](https://n8n.io/legal/).
- Los workflows activos de Novara no se modificaron.

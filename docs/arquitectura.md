# Alaia — plano técnico SaaS por capas

**Versión:** propuesta para revisión  
**Fecha:** 5 de noviembre de 2026  
**Estado:** arquitectura base aprobada por el usuario para iniciar. El repositorio de Alaia es público; no subir secretos, datos personales ni configuraciones operativas.

## Decisión de producto

Alaia será una aplicación SaaS central para barberías, spas, peluquerías y otros negocios de servicios. Un solo producto y repositorio atenderá a muchos negocios. Cada negocio tendrá su propia configuración, equipo, agenda, clientes, pagos, página pública e integraciones. Un superadministrador de Alaia controlará altas, planes, suscripciones, vencimientos, consumo, soporte e incidencias.

Nombre de trabajo: **Alaia**. El nombre comercial y el nombre del repositorio pueden cambiar sin cambiar la arquitectura.

## Estado auditado antes de proponer

- La carpeta de trabajo abierta contiene documentos de planificación, no es el repositorio de código.
- GitHub da acceso al repositorio privado **KmiloLabs/novara-bot**. Ese proyecto es el bot de Novara en producción: n8n, WhatsApp Cloud API, Firestore y Google Calendar. Se conserva separado; aporta experiencia y automatizaciones.
- El repositorio público **KmiloLabs/alaia-platform** se creó para el producto nuevo. Solo debe contener código y documentación publicables; los secretos van fuera de Git.
- El workflow principal de Novara está activo en n8n. Su exportación principal en GitHub no se puede leer como JSON válido, así que no se debe usar para restaurar ni modificar la instancia antes de reconciliarla.
- El prototipo dental adjunto tiene 39 nodos y está inactivo. Muestra un flujo útil de WhatsApp, audios, preguntas, horarios y recordatorios; está configurado como una clínica individual y usa Google Calendar y Sheets. Es una referencia conversacional, no la base multiempresa.
- La búsqueda de repositorios no encontró un proyecto popular que reúna SaaS multiempresa, gestión comercial, agenda por sectores, WhatsApp e IA con licencias adecuadas. Los repositorios con muchas estrellas cubren subconjuntos y algunos excluyen uso productivo o funciones de equipo.

## Arquitectura recomendada

**Cliente:** web adaptable a móvil y escritorio, instalable como PWA. No usar Electron para el lanzamiento.

**Entrada y páginas públicas:** Cloudflare para DNS, CDN, protección y resolución de subdominios. Una aplicación y una plantilla pública compartida resolverán el negocio según el host o slug. Subdominios primero; dominios propios en una capa posterior usando Cloudflare for SaaS y verificación de propiedad.

**API central:** Cloud Run en Google Cloud para las reglas de negocio, API, webhooks, pagos, reservas y tareas que exijan permisos de servidor. Cloud Functions de segunda generación se pueden usar para eventos puntuales de Firebase si reducen trabajo; evitar duplicar reglas de negocio entre funciones.

**Identidad:** Firebase Authentication. Una identidad puede pertenecer a uno o más negocios mediante membresías; los roles son superadministrador de plataforma, propietario/administrador, profesional/empleado y cliente. Para el MVP, el negocio (tenant) se modela en Alaia y no como un tenant de Identity Platform; la función multi-tenancy de Identity Platform es una opción que agrega coste y complejidad, no un requisito inicial.

**Datos:** Firestore con separación lógica por rutas de negocio, por ejemplo tenants/{tenantId}/appointments, customers, services, staff, payments e integrations. Las reglas validan usuario y membresía para acceso directo. Las operaciones críticas pasan por Cloud Run. Las consultas administrativas de plataforma quedan separadas de los datos accesibles por cada negocio.

**Archivos:** Cloud Storage con prefijos y metadatos de tenant, acceso mediante URLs firmadas y límites de tipo/tamaño. Los medios no se guardan dentro de documentos de Firestore.

**Automatización:** n8n puede ser una capa auxiliar central para recordatorios, notificaciones y procesos operativos. No será la fuente de verdad de agenda, pagos o permisos. Sus workflows reciben un tenantId validado, una lista pequeña de acciones permitidas y un identificador de evento idempotente; nunca secretos en código ni acceso al editor para clientes.

**Canales y proveedores:** conectores intercambiables para WhatsApp Cloud API, pasarela(s) de pago, Google Calendar opcional, modelos de IA, voz y facturación electrónica DIAN opcional. Las claves se guardan como secretos del servidor y cada conexión queda asociada a su tenant.

## Diagrama de infraestructura

Navegador / PWA  
→ Cloudflare DNS, CDN y encaminamiento por dominio  
→ aplicación web común  
→ API de Alaia en Cloud Run  
→ Firebase Authentication para identidad  
→ Firestore para negocios, membresías, agenda, clientes, planes y consumo  
→ Cloud Storage para archivos

La API valida cada solicitud y habla con WhatsApp Cloud API, pasarelas, Google Calendar opcional, Groq u otro proveedor de IA y Fish Audio u otro proveedor de audio. n8n recibe tareas auxiliares desde una cola/evento autenticado y devuelve estados; no ejecuta el libro mayor ni confirma una reserva sin validación del backend.

## Modelo lógico por capas

### Plataforma Alaia

Business/Tenant, estado, sector, plan, fecha de alta, vencimiento, límites, dominios, integraciones y uso. Usuarios y membresías relacionan identidades con negocios. Roles y permisos se verifican en cada operación.

### Negocio

Sucursales/ubicaciones, horarios, servicios, empleados/profesionales, asignación de citas, disponibilidad, clientes, página pública, canales y preferencias de comunicación.

### Agenda y operación

Citas con estados e historial, bloqueos, disponibilidad, cancelación y reagendamiento. La reserva se confirma con una transacción o mecanismo de exclusión para evitar dos citas en el mismo espacio. Google Calendar sincroniza opcionalmente, pero Alaia mantiene la fuente principal de verdad.

### Finanzas y remuneración

Planes y suscripciones, cargos, pagos, reembolsos, consumo y conciliación. La remuneración del profesional tiene reglas configurables (porcentaje, fijo, alquiler o mixto), vigencia e historial. Las liquidaciones confirmadas son inmutables; los ajustes se registran como movimientos nuevos.

### Afiliados y costos

Afiliado, referido, regla de comisión, evento que genera derecho, saldo, pago manual o automático, reverso y auditoría. Se mide consumo por negocio: WhatsApp por categoría/país/proveedor, IA por tokens/modelo, voz por segundos, archivos por almacenamiento/egreso, y operaciones de base de datos.

## Aislamiento, seguridad y auditoría

- Nunca confiar en un tenantId enviado por el navegador. El servidor deriva el negocio de una membresía autorizada o valida el recurso contra una membresía existente.
- Cada lectura y escritura de negocio incluye tenantId/ruta de tenant. Las reglas de Firestore cierran el acceso por defecto y autorizan explícitamente membresías y roles.
- La librería Admin de Firebase en Cloud Run omite las reglas de Firestore; la API debe aplicar autenticación, pertenencia, permisos y tenant scoping antes de cada consulta.
- El superadministrador usa permisos de plataforma distintos a los del negocio. Sus acciones sensibles quedan auditadas.
- Webhooks de Meta y pagos: verificar firma, deduplicar con idempotency key, validar estado y guardar el evento antes de procesarlo.
- Separar secretos por tenant/proveedor, cifrarlos en reposo, no incluirlos en prompts, registros, workflows exportados ni respuestas del cliente.
- Aplicar cuotas por tenant, límites de frecuencia, App Check donde corresponda, protección contra abuso en páginas públicas, respaldos, retención y borrado/exportación de datos.
- Audio y transcripciones se procesan con aviso y consentimiento adecuados. Solo retener lo necesario; la clonación de voz requiere permisos documentados del titular.
- Un cliente dental puede implicar datos de salud sensibles. Ese sector debe tener una revisión específica de protección de datos y de los mensajes de IA antes de venderse.

## n8n y licencia

La edición Community autohospedada usa Sustainable Use License. La guía oficial actualizada el 6 de octubre de 2026 permite crear y ejecutar workflows para clientes desde una instancia propia y que conecten sus cuentas, si los clientes solo reciben resultados y no pueden abrir el editor ni cambiar la lógica. Ofrecer n8n como servicio, exponer el editor o permitir que los clientes configuren automatizaciones requiere licencia comercial. La implementación mantendrá el editor solo para el equipo interno y confirmará por escrito con n8n cualquier flujo de credenciales de clientes antes de monetizarlo.

## Cloudflare y Electron

**Cloudflare sí encaja**, sobre todo para DNS, CDN, seguridad, subdominios y dominios personalizados. Pages tiene límites de dominios por proyecto según el plan; Cloudflare for SaaS está pensado para servir dominios de clientes hacia un origen común y tiene habilitación/condiciones de cuenta. Por eso se empieza con un solo frontend y subdominios; no se crea un proyecto o despliegue por negocio.

**Electron no hace falta ahora.** Electron empaqueta una aplicación web para escritorio; no resuelve multiempresa, backend, seguridad ni hosting. Una PWA permite empezar desde navegador y pantalla móvil, con instalación sencilla. Electron se reconsidera si hay una necesidad real de impresoras, periféricos, funcionamiento sin conexión o integración profunda con Windows.

## Papel de Groq y Fish Audio

Groq puede ser un proveedor de modelos de texto o transcripción detrás de una interfaz de proveedores. La documentación indica que las entradas y salidas de inferencia no se conservan por defecto, con excepciones para confiabilidad/abuso y funciones que requieren retención; existen controles de Zero Data Retention. Cada sector tendrá límites de IA, registro de coste y opción de proveedor alterno.

Fish Audio ofrece APIs de texto a voz y voz a texto. Se integra como módulo opcional para notas de voz, respuestas habladas o futuras funciones de voz; no se necesita para lanzar reservas por texto. Guardar proveedor, modelo, segundos y costo por tenant. El producto no dependerá de la disponibilidad, licenciamiento o precios de un único proveedor.

## Costos compartidos y variables

| Compartidos por la plataforma | Variables atribuibles a cada tenant |
| --- | --- |
| Dominio y zona principal; Cloudflare base; API y monitorización; base de Firestore; instancia n8n; operación y soporte | Mensajes Meta por país y categoría; tokens de IA; segundos de transcripción/TTS; almacenamiento/egreso; lecturas, escrituras y listeners Firestore; comisiones de pago; dominios propios |
| Se reparten sobre el total de negocios activos | Se miden desde el primer uso y alimentan cuotas, límites y facturación |

Cada evento de consumo guarda tenantId, proveedor, unidad, cantidad, costo estimado, moneda, timestamp e idempotency key. Un proceso de conciliación compara estimados con facturas reales. Los planes incluyen límites claros y margen; sobrepasar límites notifica y aplica la regla comercial acordada. No vender “ilimitado” mientras Meta y proveedores cobran por uso.

## Hosting, dominios y almacenamiento

- Desarrollo, pruebas y producción separados por proyecto/cuenta; sin compartir datos reales en desarrollo.
- Un frontend de producto y una página pública parametrizada. Los subdominios negocio.alaia… se resuelven a tenant por registro de dominio.
- Los dominios del cliente se verifican por DNS, se ligan a un tenant y se sirven por el mismo frontend. Estado de certificado y renovación queda visible al superadministrador.
- Backend único con escalado horizontal y cola para tareas que puedan reintentarse. El número de tenants no implica número de servidores.
- Almacenamiento privado por tenant, URLs firmadas con vencimiento, límites de carga y política de retención.
- No fijar todavía región, servicios pagos o límites comerciales hasta estimar volumen y confirmar requisitos de datos de los primeros clientes.

## Escalamiento de 1 a 50 y a 100 negocios

**1–10:** validar reservas, roles, dos verticales, costos por tenant y una sola ubicación/múltiples ubicaciones según necesidad. Activar presupuestos y alertas antes de conectar IA y WhatsApp.

**10–50:** automatizar onboarding y suspensión por estado de suscripción; activar colas, reintentos, cuotas por tenant, tableros de consumo, conciliación, copias de seguridad verificadas y rotación de credenciales. Simular picos y aislamiento entre negocios.

**50–100:** revisar índices, partición lógica, cargas de calendario, costos por consulta, listeners y webhooks. Ajustar Cloud Run concurrency/limits y límites de proveedores. Considerar bases separadas o regiones solo por requisito de aislamiento, residencia de datos o carga demostrada, no por defecto.

No asumir que los planes gratuitos alcanzan para este volumen: Firestore cobra por lecturas, escrituras, almacenamiento, índices y transferencia; WhatsApp y proveedores de IA/voz tienen cargos variables.

## Capas de trabajo y criterios para aprobar

1. **Capa 0 — Repositorios y seguridad operativa:** mantener Novara intacto; repositorio público de Alaia creado, con documentación y reglas Git.
2. **Capa 1 — Fundamentos:** prototipo visual iniciado; implementar Auth, membresías, roles y tenant scoping sobre Firebase/Cloud Run. Criterio: cada petición demuestra pertenencia; pruebas de acceso cruzado son denegadas.
3. **Capa 2 — Administración de plataforma:** alta/estado/plan/límites/consumo, soporte y auditoría. Criterio: el superadministrador actúa en herramientas separadas y todas las mutaciones sensibles quedan auditadas.
4. **Capa 3 — Núcleo del negocio:** servicios, profesionales, disponibilidad y agenda propia. Criterio: una reserva simultánea no duplica el horario; historial de cancelación/reagendamiento queda completo.
5. **Capa 4 — Panel y página pública:** plantillas por sector, subdominio, personalización visual y flujo de reserva. Criterio: un dominio no puede servir datos del tenant equivocado.
6. **Capa 5 — Comunicación:** WhatsApp Cloud API, confirmaciones, recordatorios, atención humana y n8n auxiliar. Criterio: webhook verificado, eventos idempotentes, errores recuperables y sin editor de n8n para clientes.
7. **Capa 6 — Cobros y afiliados:** cobro manual/automático, proveedores intercambiables, reembolsos/concilación cuando existan, comisiones y pagos de afiliado. Criterio: no se genera comisión por pago fallido/reembolsado sin el ajuste correspondiente.
8. **Capa 7 — Consumo y IA/audio:** cuotas, costos por tenant, Groq y Fish Audio opcionales, borrado/retención. Criterio: proveedor sustituible y gasto atribuible antes de habilitarlo a todos.
9. **Capa 8 — Escala y expansión sectorial:** nuevas plantillas, dominios propios, facturación electrónica mediante proveedor autorizado DIAN y voz en tiempo real tras validar demanda.

Cada capa debe cerrar con requisitos, modelo de datos, permisos, API/eventos, estrategia de errores, criterios de aceptación, revisión de riesgos y evidencia de verificación antes de abrir la siguiente.

## Fuentes oficiales consultadas

- [n8n: qué licencia aplica a cada caso de uso](https://support.n8n.io/article/can-i-use-your-license-for-my-use-case?trk=article-ssr-frontend-pulse_little-text-block)
- [Firebase: reglas de seguridad de Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firebase: transacciones y escrituras atómicas](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firebase: facturación de Firestore](https://firebase.google.com/docs/firestore/pricing)
- [Firebase: Auth multi-tenancy](https://firebase.google.com/docs/auth/)
- [Cloudflare Pages: dominios propios y límites](https://developers.cloudflare.com/pages/configuration/custom-domains/), [límites](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare for SaaS: dominios personalizados](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/)
- [Groq: tratamiento y retención de datos](https://console.groq.com/docs/your-data)
- [Fish Audio: APIs y planes](https://fish.audio/developers/), [términos empresariales](https://beta.fish.audio/enterprise-terms/)
- [WhatsApp Business Platform: precios y categorías](https://whatsappbusiness.com/products/platform-pricing/), [FAQ de tarifas](https://whatsappbusiness.com/resources/faq/)

## Dirección inicial aprobada

Dirección inicial: **web/PWA + Cloudflare para entrada/dominios + Firebase Auth/Firestore + Cloud Run para operaciones críticas + n8n solo como automatización auxiliar controlada + adaptadores separados para WhatsApp, pagos, Groq y Fish Audio**.

El prototipo actual solo cubre la presentación visual del panel. No hay login, backend, datos persistentes ni integraciones. Los proveedores comerciales y secretos se revisan antes de activar cada conexión.



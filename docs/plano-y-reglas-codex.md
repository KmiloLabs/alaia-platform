# Plataforma de servicios — plano técnico por capas e instrucciones para Codex

**Versión:** 0.1 · **Fecha:** 5 de noviembre de 2026  
**Estado:** Alaia; repositorio público creado y prototipo visual del panel iniciado. La arquitectura base está aprobada y se ajusta con evidencia al construir cada capa.


## 1. Estado comprobado y límites de esta entrega

Auditoría inicial (5 de noviembre de 2026): el directorio de la conversación solo contenía documentos; no existía una aplicación de Alaia que auditar. Después se creó el repositorio local y se publicó la base de documentación. El prototipo web actual está en `apps/web/` y no incluye backend ni persistencia.

La conversación de referencia confirma las decisiones funcionales. La dirección inicial es web/PWA, Cloudflare para entrada y dominios, Firebase Auth/Firestore, Cloud Run para operaciones críticas; n8n auxiliar sujeto a licencia. Los detalles se validarán por capa; no hay servicios conectados ni secretos en el repositorio.

## 2. Decisiones confirmadas

- SaaS central, multiempresa y multisectorial: barberías, peluquerías, spas y otros negocios de servicios.
- Una aplicación y una línea de código compartidas; cada negocio configura módulos y plantillas apropiados a su actividad.
- Aislamiento estricto de datos entre negocios mediante `tenantId`, aplicado y verificado en el backend y, donde aplique, en las reglas de datos.
- Roles: superadministrador la plataforma; propietario/administrador del negocio; empleado/profesional; cliente.
- Pagos y seguimiento de afiliados con registro manual y opciones automáticas mediante proveedores compatibles.
- Panel central para negocios, planes, suscripciones, cobros, vencimientos, estados, mantenimiento, soporte, integraciones y consumo.
- Panel por negocio: agenda, empleados, servicios, clientes, finanzas, página pública, canales de atención y configuración.
- Reservas web y por WhatsApp. IA con herramientas acotadas; voz como evolución posterior.
- Agenda del producto como fuente de verdad. Google Calendar opcional y secundario.
- Backend propio para reglas de negocio y operaciones críticas. n8n solo como auxiliar si la licencia, privacidad, aislamiento y seguridad son aceptables; nunca exponer su editor a clientes.
- Proveedores intercambiables para pagos. Verificar firmas de webhooks, tolerar reintentos de forma idempotente y registrar conciliación y reembolsos cuando el proveedor los soporte.
- Factura electrónica colombiana opcional mediante proveedor autorizado. Diferenciar recibo/comprobante interno de factura electrónica validada.
- Modelos configurables de remuneración profesional: porcentaje, tarifa fija, alquiler, mixto. Vigencia e historial; liquidaciones cerradas inmutables.
- Asignación de citas configurable: selección del cliente, asignación automática o intervención manual; reglas como disponibilidad, rotación, carga o prioridad.
- Dominios y páginas públicas servidos por plantillas/configuración por negocio; no desplegar una aplicación por cliente.
- Costos compartidos de infraestructura y costos variables atribuibles a consumo.

## 3. Principios de arquitectura

1. **Aislamiento en servidor:** el cliente nunca elige libremente el `tenantId` efectivo. Se deriva de la sesión, membresía y recurso solicitado; una comprobación central rechaza accesos cruzados.
2. **Backend como autoridad:** disponibilidad, creación/cancelación de reservas, liquidaciones, permisos, pagos, estado de suscripción y acciones de IA se validan en lógica confiable del servidor.
3. **Configuración, no bifurcaciones:** sector, reglas de agenda, marca, módulos y políticas se configuran con plantillas/versiones; no se crean forks por empresa.
4. **Historial auditable:** cambios sensibles y efectos financieros dejan actor, fecha, motivo y referencia. Una operación cerrada no cambia silenciosamente por una política nueva.
5. **Integraciones desacopladas:** contratos internos uniformes con adaptadores por proveedor, credenciales protegidas y tareas reintentables.
6. **Entregas verticales:** cada etapa entrega una ruta funcional de extremo a extremo, con criterios de aceptación antes de iniciar la siguiente.
7. **Privacidad desde el diseño:** recolectar lo necesario, limitar retención y accesos; contemplar exportación, corrección y eliminación conforme a obligaciones aplicables en Colombia.

## 4. Arquitectura lógica propuesta (independiente del stack)

```text
Web pública / portal de clientes / panel del negocio / consola la plataforma
                              │
                  API o backend confiable
     identidad · autorización · tenant · validación · auditoría
                              │
       ┌──────────────────────┼────────────────────────┐
       │                      │                        │
 Dominio central       Adaptadores externos       Trabajos/eventos
 agenda, negocio,      pagos, WhatsApp,            notificaciones,
 suscripción, finanzas calendario, factura, IA     conciliación, IA
       │                      │                        │
       └──────── Persistencia y almacenamiento ────────┘
```

Es una arquitectura lógica, no una elección de microservicios. Para el inicio se debe preferir el despliegue más simple que soporte el stack existente, las transacciones necesarias y el aislamiento. Separar servicios solo ante una necesidad demostrada. Antes de adoptar Firebase u otra plataforma, contrastar capacidades de consultas/transacciones, aislamiento, exportación, costos, observabilidad, tareas programadas, residencia de datos y portabilidad con el repositorio y los requisitos reales.

## 5. Capas, dependencias y criterios de aceptación

| Capa | Contenido y dependencias | Criterio de aceptación para avanzar |
|---|---|---|
| 0. Auditoría y decisión tecnológica | Inventario del repo, stack, flujos existentes, riesgos, ejecución local, pruebas, despliegue y secretos. Sin dependencias. | Informe reproducible con rutas/archivos, comandos observados, capacidades y vacíos; arquitectura ajustada al código existente y opciones justificadas. Aprobación explícita del usuario. |
| 1. Fundaciones | Entornos, configuración, logging, errores, migraciones/esquema, CI existente, respaldo y estrategia de despliegue. | Aplicación ejecutable en entorno documentado; secretos fuera del código; logs no filtran datos personales; cambios de esquema reversibles o con plan de recuperación. |
| 2. Identidad y tenant | Login, usuarios, organizaciones/negocios, membresías, roles, invitaciones, resolución del tenant. | Una suite de autorización demuestra que usuario de A no puede leer, modificar, listar ni inferir registros de B, incluso manipulando IDs. Superadmin usa permisos explícitos y auditados. |
| 3. Catálogo y configuración sectorial | Negocios, sedes (si se requieren), tipos de negocio, servicios, duración, recursos, horarios, marca, módulos y plantillas versionadas. | El mismo código configura dos sectores distintos sin copiar la aplicación; validación de configuración y cambios auditables. |
| 4. Profesionales y disponibilidad | Perfiles/membresías, habilidades/servicios, horarios, pausas, ausencias, capacidad y estrategia de asignación. | El cálculo evita conflictos y respeta la política elegida; cambios de disponibilidad no alteran reservas pasadas. |
| 5. Agenda y reservas | Fuente de verdad; disponibilidad, reserva, confirmación, reprogramación, cancelación, estados, zona horaria y políticas. | Operaciones concurrentes no crean doble reserva; política de cancelación y zona horaria son comprobables; cada transición queda auditada. |
| 6. Clientes y atención | Perfil de cliente por negocio, consentimiento/preferencias, historial autorizado y notas con control de acceso; web pública responsive. | Cliente ve su información; el negocio solo sus clientes; página pública consulta solo datos publicables y permite reservar por las reglas del tenant. |
| 7. Notificaciones e integraciones | Correo/SMS/WhatsApp vía adaptadores; Google Calendar opcional; cola/reintentos y estado de entrega. | Fallos externos no duplican reservas; tokens protegidos; integraciones revocables y con estado visible; Calendar no sobrescribe la agenda propia. |
| 8. Pagos y suscripciones | Planes, ciclos, intentos, pagos, reembolsos, método manual y pasarelas; webhooks firmados, idempotencia, conciliación y libro de eventos. | Reintentos del mismo webhook no duplican efectos; pago pendiente/fallido no se declara pagado; ajustes/reembolsos mantienen traza; conciliación detecta discrepancias. |
| 9. Finanzas y liquidaciones | Ventas/servicios, reglas de remuneración con vigencia, cierres, ajustes y reportes. | Liquidación cerrada es inmutable; corrección crea ajuste/reverso; reglas nuevas aplican desde su fecha efectiva y el cálculo se puede reproducir. |
| 10. Consola la plataforma y soporte | Negocios, estado, plan, suscripción, pagos, vencimientos, consumo, soporte, integraciones y acciones administrativas. | Cada acceso/acción privilegiada queda auditada; suspender limita acceso según política documentada sin borrar datos; separación de datos verificada. |
| 11. IA y WhatsApp | Intenciones acotadas, herramientas permitidas, confirmación humana/cliente para acciones, límites de consumo y registros sin secretos. | La IA solo opera sobre tenant y herramientas autorizados; no puede crear una cita sin validar disponibilidad; fallos se escalan a atención humana y no producen efectos duplicados. |
| 12. Voz y escalamiento | Canal de voz y proveedores de voz como adaptadores; carga/performance; endurecimiento operacional. | Se construye solo después de medir demanda y validar costos, consentimiento, retención y calidad. Umbrales y plan operativo documentados. |

Las capas 8 y 9 pueden desarrollarse en secuencia después de la agenda básica, priorizando la necesidad comercial. La capa 11 depende de identidad, tenant, agenda, consentimiento y adaptadores; la voz queda expresamente fuera del MVP.

## 6. Modelo de datos inicial

Nombres conceptuales; se ajustan al ORM, base de datos y convenciones existentes. Todo dato propiedad de un negocio lleva `tenantId` o llega por una relación cuya pertenencia al tenant se valida en servidor. Índices y constraints deben incluir el tenant donde corresponda.

| Entidad | Campos/relaciones esenciales |
|---|---|
| `User` | identidad del proveedor, correo/teléfono normalizado, estado; no confundir con el perfil de cliente de un negocio. |
| `Tenant` | nombre, slug único, sector, estado, zona horaria, configuración/plan referenciado, fechas. |
| `Membership` | `tenantId`, `userId`, rol, estado, permisos adicionales acotados, fecha de invitación/aceptación. |
| `Location` | `tenantId`, datos públicos/privados de sede, horario y zona horaria si hay múltiples sedes. Puede omitirse en primera etapa si el producto es de sede única. |
| `Service` | `tenantId`, nombre, duración, precio, buffers, estado, política, categoría. |
| `ProfessionalProfile` | `tenantId`, usuario/perfil asociado, servicios habilitados, presentación, estado. |
| `AvailabilityRule` / `TimeOff` | `tenantId`, profesional/recurso, regla recurrente o excepción, intervalo con zona horaria. |
| `Customer` | `tenantId`, datos mínimos de contacto, consentimiento, preferencias, estado; identificadores externos opcionales. |
| `Appointment` | `tenantId`, cliente, servicio, profesional/sede, inicio/fin, zona, estado, canal, precio congelado, política/versiones relevantes, claves de idempotencia. |
| `AppointmentEvent` | `tenantId`, cita, transición, actor, fecha, motivo y metadatos seguros; registro append-only. |
| `TenantBranding` / `PublicPageConfig` | `tenantId`, dominio/slug, plantilla/version, campos publicables y estado de publicación. |
| `Subscription` / `Plan` | estado, ciclo, fechas, límites, precio/moneda/versiones; no almacenar datos de tarjeta. |
| `Payment` / `PaymentEvent` | referencia de proveedor, importe, moneda, estado, intento, firma verificada, timestamps e idempotencia; eventos inmutables. |
| `Affiliate` / `Referral` / `CommissionLedger` | reglas versionadas, referente, tenant referido, atribución, importe y estado; evitar editar comisiones liquidadas. |
| `CompensationPolicy` | `tenantId`, profesional, tipo y parámetros, `validFrom`/`validTo`, versión y actor que aprueba. |
| `Settlement` / `SettlementLine` | periodo, profesional, líneas basadas en hechos, importes congelados, estado, cierres y ajustes enlazados. |
| `IntegrationConnection` | `tenantId`, tipo, referencia segura al secreto, scopes, estado, fecha de autorización; nunca secreto en logs. |
| `WebhookInbox` / `OutboxJob` | proveedor/tipo/id externo, hash o referencia, estado, intentos, próxima ejecución, resultado seguro; deduplicación persistente. |
| `UsageRecord` | `tenantId`, métrica, cantidad, unidad, fecha, origen; útil para límites y costos variables. |
| `SupportCase` / `AuditLog` | pertenencia, severidad/estado; bitácora de actor, acción, tenant, recurso y resultado sin contenido sensible innecesario. |

**Convenciones:** importes en unidad menor entera y moneda explícita; timestamps en UTC más zona IANA de negocio; borrado lógico solo donde aporte valor y sin sustituir reglas de retención; snapshots de precio/política para reproducir operaciones históricas; índices únicos compuestos por `tenantId` para slugs/IDs externos donde aplique.

## 7. Roles y límites de permisos

| Acción | Superadmin la plataforma | Propietario/admin | Profesional | Cliente |
|---|---|---|---|---|
| Administrar tenants, planes y estado de plataforma | Sí, con auditoría | No | No | No |
| Configurar negocio, servicios, agenda y equipo | Soporte excepcional con motivo | Sí según plan | Solo disponibilidad/perfil propio si se habilita | No |
| Ver agenda del negocio | Acceso de soporte excepcional, mínimo y auditado | Sí | Agenda permitida por política | Sus propias reservas |
| Administrar pagos la plataforma | Sí | Ver/gestionar suscripción propia según permisos | No | No |
| Administrar finanzas/liquidaciones | No por defecto; soporte auditado | Sí | Ver su propio resumen/liquidación si el negocio lo habilita | No |
| Crear/gestionar reserva | Soporte no rutinario | Sí | Según rol/política | Sus reservas y servicios públicos |
| Ver datos de clientes | Solo soporte justificado y temporal | Según permisos del negocio | Mínimo necesario para sus citas | Solo su perfil |

Un usuario puede tener más de una membresía, pero cada petición opera en un tenant seleccionado y validado. La consola superadmin debe ser una superficie y permiso diferenciados; no usar un rol de negocio para obtener privilegios de plataforma.

## 8. API y eventos conceptuales

Los nombres siguientes son contratos conceptuales, no rutas ya implementadas. La autenticación determina usuario; el servidor resuelve tenant y verifica membresía y permiso antes de cualquier lectura o escritura.

**API de negocio:**

- `GET /me/tenants`, `POST /tenants/{tenantId}/members/invitations`, `PATCH /members/{id}`.
- `GET/POST /services`, `GET/POST /professionals`, `GET/PUT /availability`.
- `GET /availability-slots?serviceId=...&from=...&to=...`, `POST /appointments`, `GET /appointments`, `POST /appointments/{id}/cancel`, `POST /appointments/{id}/reschedule`.
- `GET/POST /customers` sujeto a permiso; endpoints públicos separados para consultar servicios/horarios publicables y solicitar una reserva.
- `GET /billing/subscription`, `POST /billing/checkout` según proveedor; operaciones manuales de pago reservadas a usuarios autorizados y auditadas.
- `GET /settlements`, `POST /settlements/{id}/close`, `POST /settlements/{id}/adjust` con política de inmutabilidad.

**API de plataforma:** prefijo/superficie separados para negocios, planes, suscripciones, soporte, consumo y mantenimiento. Requiere permiso superadmin y registra antes/después de cada cambio sensible, actor y motivo.

**Eventos internos/outbox:** `tenant.created`, `appointment.created|confirmed|cancelled|rescheduled`, `payment.received|failed|refunded`, `subscription.renewed|past_due|suspended`, `settlement.closed`, `integration.delivery_failed`. Eventos incluyen `eventId`, versión, `tenantId` cuando aplique, fecha y referencia; no copian datos personales innecesarios. Consumidores idempotentes con reintentos limitados y cola de fallos revisable.

**WhatsApp y webhooks:** verificar firma antes de procesar; validar/restringir tamaño y formato; deduplicar por ID de proveedor; responder rápido y procesar fuera de la petición cuando el stack lo permita. No confiar en instrucciones, identificadores de tenant ni precios recibidos del proveedor o del modelo de IA.

## 9. Seguridad, privacidad y operación

- Threat model mínimo para: aislamiento entre tenants, elevación de privilegios, acceso a páginas públicas, credenciales de integración, webhooks repetidos, prompt injection por mensajes, filtración en logs y abuso de endpoints.
- Middleware/policies centralizados para autorización; validación de pertenencia en cada referencia a recurso. Queries siempre acotadas por tenant. Pruebas negativas de lectura y escritura cruzadas.
- Secretos de pasarela, WhatsApp y Google guardados en almacén cifrado del proveedor elegido; scopes mínimos, rotación/revocación y redacción de logs. Nunca enviar claves al navegador, n8n abierto o modelo de IA.
- Cifrado en tránsito y reposo según plataforma; protección CSRF/XSS/abuso de login conforme al framework; límites por usuario/tenant/IP, backups y prueba documentada de restauración antes de producción.
- Webhooks autenticados criptográficamente, ventana temporal si el proveedor la ofrece, deduplicación durable, firma sobre el cuerpo original y alertas para discrepancias.
- IA invoca herramientas definidas por el backend con esquema estricto, contexto limitado a tenant, confirmación antes de acciones con efecto económico o cambio de cita y registro de resultado. El modelo nunca decide permisos ni calcula liquidaciones.
- Política de retención, exportación y eliminación por tipo de dato y requisito legal. En Colombia, validar con asesoría competente obligaciones de protección de datos, mensajes comerciales y facturación DIAN antes del lanzamiento; no asumir que comprobante interno cumple función de factura.
- Métricas agregadas por tenant y plataforma: reservas, fallos de integración, latencia, uso IA/mensajes y costo; evitar que paneles operativos expongan datos personales innecesarios.

## 10. Pruebas y evidencia esperada por capa

Las pruebas son parte de los criterios de salida de una etapa, pero **no se deben ejecutar ni añadir ahora** porque el trabajo solicitado en este turno es documentación y la instrucción previa prohíbe implementar antes de aprobar. Tras aprobación, Codex debe primero inspeccionar las pruebas y herramientas existentes y proponer una matriz apropiada al stack.

Matriz futura mínima a cubrir durante implementación: autorización por rol y aislamiento tenant; reglas de agenda/concurrencia/zona horaria; transición de estados; idempotencia de webhooks y trabajos; cálculo reproducible e inmutabilidad de liquidaciones; límites de uso y estados de suscripción; integración degradada/reintentos; herramientas de IA autorizadas; restauración de respaldo. Cada criterio debe apuntar a evidencia reproducible y no contener secretos ni datos reales innecesarios.

## 11. Riesgos y decisiones pendientes

| Riesgo/decisión | Cómo resolverlo antes de implementarlo |
|---|---|
| Repositorio/stack no identificado | Usuario/Codex localiza la carpeta correcta; inventariar y ejecutar solo instrucciones documentadas existentes sin modificar datos. |
| Firebase frente a stack actual | Comparar el stack encontrado con transacciones de agenda/pagos, reglas tenant, consultas/reportes, portabilidad, costo estimado y operación. Documentar decisión y migración. |
| Marco multi-tenant | Elegir estrategia apropiada al motor (compartida con tenant key u otra); documentar constraints, índices, migración, restauración y pruebas de aislamiento. |
| Precios, moneda, planes y cobro de la plataforma | Definir mercado inicial, moneda, periodicidad, tolerancia a mora, suspensión, impuestos y manejo de cambio de plan. |
| Afiliados | Precisar atribución, comisión, ventana, reversos por reembolso, pagos manuales/automáticos, mínimos, saldo y reportes. |
| WhatsApp e IA | Elegir proveedor/canal, opt-in, plantillas, ventanas y costos; definir qué herramientas son permitidas y qué requiere confirmación humana. |
| Facturación DIAN | Decidir si MVP la necesita; validar proveedor autorizado, responsabilidades de emisor, numeración y flujo de contingencia. |
| n8n | Revisar licencia aplicable al modelo comercial y separación de credenciales/ejecuciones; si hay duda, mantener integraciones en backend/cola propia. |
| Varias sedes y recursos no humanos | Validar con primeros clientes; modelar recursos configurables solo si agenda real los requiere. |
| Dominio y hosting | Definir dominio raíz y wildcard, DNS, SSL y flujo de dominios del cliente; costos por tenant como consumo, sin despliegue individual. |
| Regulación/privacidad | Revisar con profesional competente el tratamiento de datos personales y obligaciones comerciales/tributarias antes de lanzamiento. |

## 12. Orden recomendado de producto

1. Auditoría del repo y decisión tecnológica aprobada.
2. Tenant, identidad, membresías y autorización probada.
3. Catálogo/plantillas, profesionales y disponibilidad.
4. Reserva web funcional con estados, concurrencia y notificaciones básicas.
5. Panel del negocio, clientes y página pública por plantilla.
6. Suscripciones/pagos la plataforma y consola superadmin; comenzar con registro manual si reduce riesgo, manteniendo el contrato para pasarela.
7. WhatsApp conectado a las mismas operaciones confiables de agenda.
8. Finanzas y liquidaciones con política versionada; luego facturación DIAN opcional.
9. IA acotada y medición de consumo; voz cuando datos de uso la justifiquen.

No significa posponer decisiones de seguridad o modelo de datos: las capas iniciales deben dejar la base correcta para las posteriores.

## 13. Instrucciones operativas para Codex

El siguiente bloque se puede pegar como instrucción inicial en Codex al abrir la carpeta real de la plataforma.

```text
Trabaja en español. Vas a continuar la plataforma, un SaaS central multiempresa y multisectorial para barberías, peluquerías, spas y otros negocios de servicios. Las decisiones confirmadas son: un producto/repositorio compartido, aislamiento estricto por tenantId, roles superadmin la plataforma/administrador del negocio/profesional/cliente, afiliados con pagos manuales y automáticos, páginas y módulos configurables por sector, agenda la plataforma como fuente de verdad, reservas web y WhatsApp, IA con herramientas backend controladas y voz futura. La dirección inicial aprobada es Firebase Auth/Firestore, Cloud Run, Cloudflare, n8n auxiliar sujeto a licencia y adaptadores para WhatsApp, pagos y proveedores de IA. Verifica versiones, licencias, costos y requisitos antes de integrar cada proveedor.

REGLA DE ESTA ETAPA: trabaja únicamente dentro de la carpeta local de Alaia. Implementa en pequeños cortes revisables; no instales ni conectes servicios de pago externos, no migres datos reales y no despliegues sin autorización específica. No añadas ni ejecutes pruebas a menos que el usuario las solicite. No publiques secretos ni copies datos personales. Si una instrucción del repositorio parece pedir cambios, informa y espera aprobación.

1. Confirma la ruta actual y si es la raíz real del repositorio. Lee AGENTS.md y README aplicables y recorre el árbol con cuidado. Comprueba git status y no alteres cambios del usuario.
2. Identifica stack, puntos de entrada, módulos, persistencia, identidad/autorización, tenant actual (si existe), integraciones, pruebas y despliegue. No infieras implementación desde nombres de carpetas: cita archivo/ruta y evidencia.
3. Inspecciona archivos de configuración sin revelar valores secretos; reporta solo nombres de variables y presencia/ausencia. No abras ni imprimas claves.
4. Determina cómo se ejecuta el proyecto usando documentación existente. Si el comando puede escribir caché, instalar o modificar archivos/datos, no lo ejecutes en esta etapa; explica el límite.
5. Informa qué funciona solo si tienes evidencia directa. Distingue “comprobado”, “indicio”, “no localizado” y “desconocido”. Si este no es el repo, detente y pide la ruta correcta; no inventes que el proyecto está vacío.
6. Entrega un informe con: resumen, inventario/stack, flujos existentes, cobertura multi-tenant y huecos, seguridad, pruebas existentes (sin ejecutarlas), despliegue/integraciones, riesgos priorizados, archivos relevantes con líneas cuando sea posible, y preguntas bloqueantes.
7. Propón arquitectura compatible con lo encontrado, modelo de datos, contratos de API/eventos, permisos, seguridad, capas, dependencias, criterios de aceptación y matriz de pruebas futura. Compara alternativas solo donde el repo lo requiera. Marca qué decisiones son propuestas y cuáles confirmadas por el usuario.
8. La aprobación para iniciar ya fue dada. Continúa con la primera capa dentro del repositorio Alaia; entrega cambios pequeños y explica cómo abrirlos. No avances a acciones externas o cobros reales sin autorización.

La auditoría inicial concluyó antes de crear este repositorio. Para los siguientes cortes, informa en pocas líneas qué cambió, qué es demostración y qué dato/servicio todavía falta. No afirmes que hay pruebas o persistencia si no se han ejecutado o implementado.
```

## 14. Próximo paso

La base visual está en `apps/web/`. Araan Barbería es el primer piloto previsto, con un solo profesional; por ahora usa exclusivamente datos ficticios. El siguiente corte conecta Firebase Authentication, membresías y resolución de tenant en el servidor; después se implementan servicios, horario, disponibilidad y reservas. Google Calendar será opcional y secundario. Los datos reales de Araan se cargan cuando el dueño pueda revisar el flujo y autorice el uso.


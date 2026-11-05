# Plataforma de servicios — plano técnico por capas e instrucciones para Codex

**Versión:** 0.1 · **Fecha:** 5 de noviembre de 2026  
**Estado:** Alaia; prototipo visual y API inicial de identidad/tenant implementados. El workflow de recepción aún no se creó en la instancia n8n del usuario; se identificó una discrepancia entre la instancia de la herramienta conectada y la URL de n8n compartida. El prototipo dental de 39 nodos está disponible localmente para adaptar, pero no debe activarse tal cual. El agente funcional y el ensayo del piloto siguen pendientes.


## 1. Estado comprobado y límites de esta entrega

Auditoría inicial (5 de noviembre de 2026): el directorio de la conversación solo contenía documentos; no existía una aplicación de Alaia que auditar. Después se creó el repositorio local y se publicó la base de documentación. El prototipo web actual está en `apps/web/` y no incluye backend ni persistencia.

La conversación de referencia confirma las decisiones funcionales. La dirección inicial es web/PWA, Cloudflare para entrada y dominios, Firebase Auth/Firestore, Cloud Run para operaciones críticas; n8n auxiliar sujeto a licencia. Los detalles se validarán por capa; no hay servicios conectados ni secretos en el repositorio.

La auditoría del prototipo dental y los pasos para adaptarlo están en `docs/n8n-recepcionista-empresarial.md`. La sesión de navegador de la URL del usuario mostró inicio de sesión; no se ingresaron credenciales ni se tocó esa instancia.

## 2. Decisiones confirmadas

- SaaS central, multiempresa y multisectorial: barberías, peluquerías, spas y otros negocios de servicios.
- Una aplicación y una línea de código compartidas; cada negocio configura módulos y plantillas apropiados a su actividad.
- Aislamiento estricto de datos entre negocios mediante `tenantId`, aplicado y verificado en el backend y, donde aplique, en las reglas de datos.
- Roles: superadministrador la plataforma; propietario/administrador del negocio; empleado/profesional; cliente.
- Pagos y seguimiento de afiliados con registro manual y opciones automáticas mediante proveedores compatibles.
- Panel central para negocios, planes, suscripciones, cobros, vencimientos, estados, mantenimiento, soporte, integraciones y consumo.
- Panel por negocio: agenda, empleados, servicios, clientes, finanzas, página pública, canales de atención y configuración.
- Reservas web y por WhatsApp. IA con herramientas acotadas; voz como evolución posterior.
- El agente lleva la conversación con el cliente para que el profesional pueda concentrarse en prestar el servicio. Identifica si es nuevo o recurrente usando hechos del sistema, consulta historial autorizado, responde, agenda y deriva casos que requieran una persona.
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
| 0. Base del proyecto — en curso | Repositorio, decisiones, reglas de seguridad y prototipo visual. | El proyecto abre localmente, los datos de ejemplo están identificados y no hay secretos en Git. |
| 1. Identidad y tenant — siguiente | Inicio de sesión, negocio/tenant, membresías, roles y selección segura del negocio activo. | Pruebas de autorización confirman que un usuario de Araan no puede leer ni alterar datos de otro tenant, incluso manipulando IDs. |
| 2. Configuración del piloto | Crear Araan en staging con un profesional, servicios, precios, duración, horarios y zona horaria. | El dueño puede revisar y corregir los datos de muestra; ningún dato real se carga sin su autorización. |
| 3. Agenda y reservas | Disponibilidad y agenda propia, creación, confirmación, cancelación y reprogramación; página pública de reservas. | No hay doble reserva; horarios y zona horaria son correctos; toda transición queda registrada y limitada al tenant. |
| 4. Administrador, caja e inventario | Panel conectado a datos reales del tenant; citas y profesionales; registro de ventas; productos, existencias, entradas y salidas; ingresos por día/semana/mes. | Solo se descuentan existencias al confirmar la venta; historial de movimientos conserva quién hizo el cambio; totales financieros se derivan de operaciones registradas. |
| 5. Agente de atención y ventas | Agente para web/WhatsApp que lleva la conversación, identifica clientes nuevos/recurrentes con historial autorizado, consulta servicios, horarios, disponibilidad y productos; crea/actualiza citas con herramientas del backend; deriva casos a una persona. | El agente nunca inventa disponibilidad, precio, historial ni stock. Pide confirmación antes de reservar, cancelar, reprogramar o registrar venta; acciones repetidas no duplican citas, ventas ni movimientos de inventario. |
| 6. Ensayo integrado en staging | Completar un recorrido entero con datos ficticios: configurar negocio, reservar por web y agente, atender, registrar venta y revisar inventario/ingresos. Proyecto y cuentas separados de producción. | El dueño de Araan completa el flujo con datos ficticios; permisos, citas, stock y reportes coinciden; se corrigen errores bloqueantes antes del piloto real. |
| 7. Piloto real de Araan | Cargar únicamente la información necesaria y aprobada por el dueño; acompañar el uso inicial y registrar incidencias. | Consentimiento y privacidad revisados; respaldo y soporte listos; no activar pagos o mensajes automáticos hasta aprobarlos expresamente. |
| 8. Integraciones y administración SaaS ampliada | Google Calendar opcional y secundario, WhatsApp real, planes, suscripciones, límites, consumo, cobros de Alaia y afiliados. | Webhooks y reintentos idempotentes; acciones de superadmin auditadas; credenciales protegidas; Calendar no reemplaza la agenda de Alaia. |
| 9. Crecimiento | Plantillas para otros sectores, dominios propios, métricas sociales si las APIs oficiales conceden acceso, IA avanzada y voz. | Cada integración tiene permisos y costos por tenant; se incorpora después de validar demanda y soporte. |

Se revisa cada cambio mientras se construye, pero el **ensayo del MVP completo** ocurre en staging cuando estén integrados administrador, agenda, inventario, agente y reportes. No se prueba el producto con datos reales antes de superar ese recorrido.

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
| `Customer` | `tenantId`, datos mínimos de contacto, consentimiento/preferencias de contacto, primera/última visita, conteo de visitas, estado e identificadores externos opcionales. |
| `CustomerPreference` / `CustomerNote` | Servicio/producto/profesional preferido o nota estrictamente útil; actor, fecha, fuente y control de acceso. Evitar categorías sensibles y texto innecesario. |
| `CustomerInteraction` | `tenantId`, canal, fecha, resultado y referencias a cita/venta; clasificación nuevo/recurrente derivada de hechos registrados, no inventada por el modelo. |
| `Appointment` | `tenantId`, cliente, servicio, profesional/sede, inicio/fin, zona, estado, canal, precio congelado, política/versiones relevantes, claves de idempotencia. |
| `AppointmentEvent` | `tenantId`, cita, transición, actor, fecha, motivo y metadatos seguros; registro append-only. |
| `Product` | `tenantId`, nombre, SKU opcional, precio, estado, stock mínimo y política de venta. |
| `InventoryMovement` | `tenantId`, producto, tipo (entrada/venta/ajuste/devolución), cantidad, actor, venta de origen y fecha; registro append-only. |
| `Sale` / `SaleLine` | `tenantId`, productos/servicios, cantidades, precios congelados, descuentos autorizados, estado y forma de pago; claves de idempotencia. |
| `AgentSession` / `AgentAction` | `tenantId`, canal, cliente, estado y herramientas solicitadas; guardar solo contexto útil y referencias, no audio/transcripciones completos por defecto. |
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
- `GET/POST /products`, `GET /inventory`, `POST /inventory/movements`, `POST /sales`; una venta y su salida de inventario se confirman en una operación idempotente.
- Herramientas internas del agente: consultar catálogo/disponibilidad, proponer cita, solicitar confirmación y registrar una cita o venta por las mismas reglas de backend; nunca acceso general a Firestore.
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

La comprobación se hace en dos niveles:

1. **Durante cada capa:** probar las reglas pequeñas con datos ficticios y corregir errores antes de añadir la siguiente.
2. **Ensayo MVP integrado:** en staging, completar de principio a fin el uso del dueño, barbero, cliente y agente, incluyendo venta/stock y reportes.
3. **Revisión del piloto:** el dueño de Araan recorre el sistema de staging con clientes ficticios y da sus observaciones.
4. **Piloto real limitado:** solo tras cerrar errores críticos, contar con autorización del dueño y preparar consentimiento, privacidad, respaldo y soporte.

Las pruebas automatizadas se añaden a las capas que verifican reglas críticas: aislamiento tenant, disponibilidad sin dobles reservas, permisos/memoria del agente, consentimiento/retención, inventario y cálculo de ingresos. El agente solo consulta historia dentro de su tenant y para el propósito permitido. Antes del piloto real no se envían mensajes ni se procesan cobros reales desde staging. No se necesitan seguidores sociales, voz ni todos los sectores para validar el primer MVP.

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

La base visual está en `apps/web/`; aún no es un sistema ensayable. Araan Barbería es el piloto previsto, con un solo profesional. El siguiente corte es identidad y tenant; después se completan configuración, agenda, administrador con stock/caja y agente. Cuando ese MVP esté integrado, se hace el ensayo en staging con datos ficticios y luego se invita al dueño de Araan a revisarlo. Los datos reales solo se cargan con autorización. Google Calendar es opcional y secundario.


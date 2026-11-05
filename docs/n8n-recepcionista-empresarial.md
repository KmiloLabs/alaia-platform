# Recepcionista empresarial en n8n

**Estado auditado al 5 de noviembre de 2026:** la plantilla limpia `infra/n8n/alaia-reception-v1.json` ya fue importada como workflow nuevo en la instancia correcta: `Alaia · Recepción multiempresa · v1 (prueba interna)`. Se ensayó el webhook de prueba con un evento ficticio; el flujo devolvió `appointment_request` y una propuesta de consulta, sin efectos de negocio. El workflow permanece inactivo. El original dental sigue intacto. La copia de adaptación anterior quedó mezclada por una importación que añadió nodos en lugar de reemplazarlos; no se publicó ni borró. No se modificó Novara.

## Qué aporta cada base y qué no se copia

- **TurnosPro:** producto SaaS central para varios negocios y sectores, aislamiento por `tenantId`, roles, historial de cliente y agenda propia; las acciones críticas quedan en backend.
- **Novara:** patrones de normalización, intención, reserva/cambio/cancelación, pausa del bot, derivación humana y reportes. Es específico de un negocio y no mostró aislamiento por tenant. No se copian calendarios, destinos, credenciales ni acceso directo a Firestore.
- **Clínica dental:** aporta secuencia de recepción, texto/audio, aclaración, consulta de disponibilidad antes de confirmar y derivación. Sus pacientes, doctora, agenda de Google y hojas no encajan como sistema central de Alaia.
- **Código Alaia:** API actual implementa identidad, alta de tenant y verificación de membresía/contexto. No implementa todavía clientes, servicios, citas, productos, inventario, IA ni WhatsApp. El panel web es demostración.

## Flujo de prueba v1

La plantilla nueva tiene seis elementos: webhook interno → validación del evento → clasificación básica de intención → bifurcación válida/inválida → respuesta JSON y nota de límites. Reconoce solicitudes de cita, cambio/cancelación, historial, productos, información pública, atención humana y otras.

Es un arnés de contrato, no el agente IA final. Solo devuelve una propuesta; no lee ni modifica clientes, agenda, inventario o WhatsApp. No tiene credenciales y queda inactivo. La API debe verificar el canal, derivar `tenantId` desde una configuración confiable y deduplicar `eventId` antes de llamar al workflow. La marca `authenticatedByBackend` del JSON no autentica una petición HTTP por sí sola.

## Pruebas realizadas / pendientes

Las pruebas locales de contrato están en `infra/n8n/workflow-contract.test.js`: datos requeridos, clasificación de seis tipos de solicitud, rechazo de entradas inválidas, ausencia de credenciales e inactividad. También se ejecutó el webhook de prueba en n8n con datos sintéticos. La primera llamada reveló que n8n coloca los campos bajo `body`; se corrigió el código del nodo y el archivo versionado para leer ese formato. La segunda llamada devolvió una propuesta `request_availability_lookup` y controles que confirman que no hubo reserva, lectura de CRM, cambio de inventario ni envío de WhatsApp.

## Secuencia siguiente

1. Importar el JSON como workflow nuevo, no sobre el flujo dental ni sobre la copia mezclada; revisar visualmente nodos y estado inactivo.
2. Ejecutar casos ficticios de cada intención y entradas inválidas en la instancia correcta.
3. Implementar en la API contratos protegidos para catálogo, perfil público, clientes, disponibilidad, reservas y productos; cada ruta deriva y autoriza el tenant.
4. Conectar un modelo configurable con salida estructurada. La IA propone; backend y permisos deciden. Groq sigue como candidato por evaluar, no como integración ya hecha.
5. Entrar desde WhatsApp solo mediante webhook verificado en backend; añadir voz más adelante.
6. Probar idempotencia, intentos repetidos, acceso cruzado entre tenants, cliente nuevo/recurrente, conflictos de agenda, cambios, stock y derivación humana con datos ficticios.
7. Usar Araan como piloto después, primero con configuración y clientes ficticios. Cargar datos reales requiere autorización del dueño.

No activar el workflow hasta configurar autenticación de entrada, contratos de API y controles de tenant. No borrar la copia mezclada sin revisar su historial; se puede limpiar después de verificar la nueva plantilla.

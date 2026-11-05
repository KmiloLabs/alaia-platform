# Recepcionista empresarial en n8n

**Estado real al 5 de noviembre de 2026:** la instancia n8n correcta ya contiene una copia de trabajo `ALAIA - Araan Barbería - base de adaptación (borrador)`, creada desde el workflow existente `Recepcionista epresarial IA`. La copia conserva los 39 nodos de la base y sigue sin adaptar ni publicar. El original quedó intacto. No se modificaron workflows de Novara.

## Base disponible para adaptar

Archivo local disponible: `recepcionista-dental.json`.

- Nombre: `Recepcionista IA · Clínica dental (WhatsApp)`.
- 39 nodos; está inactivo.
- Incluye recepción por WhatsApp, manejo de texto/audio, agente IA, memoria, consulta/creación de citas en Google Calendar, registro en Google Sheets y recordatorios.
- En el archivo no aparecen credenciales configuradas. Las conexiones/proveedores deben configurarse dentro de la instancia del usuario.
- Está hecho para una clínica dental y una sola agenda; no es multi-tenant y no debe activarse tal cual para Alaia.

## Base duplicada en n8n

La copia está visible en la instancia correcta. Conserva la estructura dental para que podamos adaptarla por etapas; sus nodos todavía contienen lógica y referencias a clínica, doctora, pacientes y hojas de Google. No debe probarse con clientes ni publicarse en este estado.

## Cómo convertir la copia en la primera versión de Alaia

1. Mantener la copia `ALAIA - Araan Barbería - base de adaptación (borrador)` como área de trabajo y dejar intacto el original.
2. Mantenerlo inactivo durante adaptación; quitar recordatorios y ramas que no formen parte de la primera prueba.
3. Sustituir el contexto dental por Araan Barbería y configurar servicios, duración, horarios, zona horaria y profesional con datos ficticios inicialmente.
4. Cambiar la agenda de Google Calendar por el API de Alaia cuando esté disponible. Hasta entonces, una prueba manual debe quedar marcada como demostración y no como agenda real.
5. Revisar todas las acciones de WhatsApp/IA y crear las credenciales solo en la instancia correcta; nunca escribir secretos en el JSON ni en Git.
6. Probar conversación, disponibilidad, confirmación, cancelación, repetición de mensaje y derivación humana con un teléfono de prueba; activar únicamente después de revisar cada ruta.
7. Convertir luego la prueba de Araan en plantilla multiempresa: tenant resuelto desde backend, configuración separada por negocio y acciones críticas delegadas al API central.

## Próximo paso

Inspeccionar y adaptar primero la configuración/contexto del negocio y las rutas de cita de la copia. No sustituir Google Calendar por una falsa agenda central: la API de Alaia debe ofrecer las operaciones autorizadas antes de conectar reservas reales. Mantener WhatsApp, IA, recordatorios y reportes sin publicar hasta completar la prueba con datos ficticios.

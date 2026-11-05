# Recepcionista empresarial en n8n

**Estado real al 5 de noviembre de 2026:** el workflow de Alaia aún no está creado en la instancia n8n del usuario. La conexión disponible para esta sesión apunta a otra instancia. El borrador anterior se creó allí por error y no debe considerarse parte del proyecto Alaia. No se modificaron workflows de Novara.

## Base disponible para adaptar

Archivo local disponible: `recepcionista-dental.json`.

- Nombre: `Recepcionista IA · Clínica dental (WhatsApp)`.
- 39 nodos; está inactivo.
- Incluye recepción por WhatsApp, manejo de texto/audio, agente IA, memoria, consulta/creación de citas en Google Calendar, registro en Google Sheets y recordatorios.
- En el archivo no aparecen credenciales configuradas. Las conexiones/proveedores deben configurarse dentro de la instancia del usuario.
- Está hecho para una clínica dental y una sola agenda; no es multi-tenant y no debe activarse tal cual para Alaia.

## Cómo convertir la base en la primera versión de Alaia

1. Abrir el prototipo en la instancia correcta y duplicarlo/importarlo con nombre `ALAIA - Recepcionista Araan (prueba)`.
2. Mantenerlo inactivo durante adaptación; quitar recordatorios y ramas que no formen parte de la primera prueba.
3. Sustituir el contexto dental por Araan Barbería y configurar servicios, duración, horarios, zona horaria y profesional con datos ficticios inicialmente.
4. Cambiar la agenda de Google Calendar por el API de Alaia cuando esté disponible. Hasta entonces, una prueba manual debe quedar marcada como demostración y no como agenda real.
5. Revisar todas las acciones de WhatsApp/IA y crear las credenciales solo en la instancia correcta; nunca escribir secretos en el JSON ni en Git.
6. Probar conversación, disponibilidad, confirmación, cancelación, repetición de mensaje y derivación humana con un teléfono de prueba; activar únicamente después de revisar cada ruta.
7. Convertir luego la prueba de Araan en plantilla multiempresa: tenant resuelto desde backend, configuración separada por negocio y acciones críticas delegadas al API central.

## Bloqueo actual

La dirección compartida abrió una pantalla de inicio de sesión en el navegador automatizado. No se ingresaron ni solicitaron credenciales. Para crear/duplicar el workflow visible dentro de esa instancia, el usuario debe iniciar sesión manualmente y avisar cuando aparezca el listado de workflows. Después se inspeccionará lo que existe y se hará la adaptación allí, sin modificar Novara.

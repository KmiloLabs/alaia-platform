# Onboarding del negocio: qué datos se piden y en qué orden

**Principio:** pedir lo mínimo para arrancar y el resto de forma progresiva. Cada campo extra en el registro reduce la gente que termina. La referencia estándar es el *progressive profiling*: primero lo indispensable, luego se completa dentro del panel con una lista de pasos ([fuente](https://kompassify.com/blog/progressive-profiling-guide)).

## 1. Paso 1 — la cuenta (10 segundos)

- Nombre y correo (o "Continuar con Google").
- Contraseña solo si no usa Google.

Ya está implementado.

## 2. Paso 2 — el negocio (obligatorio, 3 campos)

| Campo | Obligatorio | Por qué |
|---|---|---|
| Nombre del negocio | Sí | Aparece en la agenda, en los mensajes y en la página pública |
| Sector | Sí | Cambia las etiquetas ("barbero", "terapeuta") y las plantillas sugeridas |
| Ciudad o zona horaria | Sí | Toda la agenda depende de la hora local |

No se pide dirección ni teléfono aquí: no bloquean el arranque. Y todo esto ya existe en la API (`POST /tenants`).

## 3. Paso 3 — lo que hace funcionar la agenda (obligatorio para operar)

Se pide **dentro del panel**, con valores por defecto para no frenar a nadie:

| Dato | Valor por defecto | Dónde |
|---|---|---|
| Horario de atención | Lunes a sábado 9:00–18:00, domingo cerrado | Configuración → Horario |
| Al menos un servicio | — (es el único bloqueante real) | Servicios |
| Equipo | El dueño como primer profesional | Equipo → Invitar |

El asistente de IA ya funciona con lo anterior: sin servicios cotiza mal, por eso se pide primero.\n\n**Plantillas por sector:** al crear el negocio se precargan servicios típicos con precio y duración (barbería, peluquería, spa, uñas, pestañas, cejas, masajes, estética). El dueño solo ajusta los suyos o desactiva lo que no ofrezca; la respuesta de `POST /tenants` incluye `seededServices`. Si no quiere la plantilla, puede desactivar los servicios uno por uno (no se le obliga a nada).

## 4. Paso 4 — presencia pública (recomendado, no bloqueante)

| Campo | Uso |
|---|---|
| Dirección | Página pública y WhatsApp ("¿dónde queda?") |
| Teléfono del negocio | Contacto y, más adelante, el número de WhatsApp |
| Descripción corta | Encabezado de la página pública |
| Instagram, Facebook, TikTok, sitio web | Enlaces de la página pública |
| Logo | Página pública (después) |

Estos campos ya existen en el perfil del negocio (`PATCH /tenants/:id`).

## 5. Paso 5 — fiscal (solo cuando se facture)

Cuando el negocio tenga RUT y quiera factura electrónica:

- NIT y dígito de verificación.
- Razón social.
- Régimen y responsabilidad fiscal.
- Correo de facturación.
- Resolución de numeración (la entrega el proveedor autorizado).

**No se pide en el registro.** No todos facturan electrónicamente al inicio, y sin RUT no aplica. Se implementa junto con la integración del proveedor autorizado (DIAN), no antes.

## 6. Lista de configuración en el panel ("pon tu negocio a punto")

Patrón de SaaS: una tarjeta con pasos y progreso, que desaparece cuando está completa.

1. Completa el perfil (dirección, teléfono, redes).
2. Define tu horario de atención.
3. Crea tu primer servicio.
4. Invita a tu equipo.
5. Configura tu asistente de IA (proveedor, tono e instrucciones).
6. Conecta WhatsApp (cuando esté disponible).

Cada paso muestra estado (hecho / pendiente) y lleva directo a la pantalla. El progreso se calcula desde el contexto del negocio, servicios, equipo y configuración del agente; no hace falta guardar nada extra.

## 7. Qué NO pedir nunca al inicio

- RUT/NIT sin facturación.
- Datos de empleados uno por uno: se invitan después con QR/WhatsApp.
- Tarjeta de crédito antes de la prueba: la prueba de 14 días no la pide.
- Contraseña si entra con Google.

## 8. Criterios de aceptación (cuando se implemente la lista)

- Un negocio nuevo ve la tarjeta de pasos con 1–2 completados.
- Completar cada paso marca su casilla sin recargar.
- La tarjeta desaparece cuando todo está listo.
- El onboarding no crece: sigue pidiendo solo nombre, sector y zona horaria; contacto y horario se completan con la lista.

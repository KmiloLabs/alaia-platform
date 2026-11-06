# Recepcionista IA de n8n → Alaia: qué se reutiliza y cómo se conecta

**Fuente analizada:** workflow `Recepcionista epresarial IA` (39 nodos, inactivo) en la instancia n8n del usuario. Se leyó vía API; no se modificó nada en n8n. También existen en esa instancia `ALAIA - Araan Barbería - base de adaptación (borrador)` (78 nodos, copia mezclada que el repo ya advierte no publicar) y `Alaia · Recepción multiempresa · v1 (prueba interna)` (6 nodos, arnés de contrato de `infra/n8n/`).

## 1. Qué hace hoy el workflow

```text
WhatsApp Trigger → Datos de la clínica (Set) → Lee el mensaje (Code) → Tipo de mensaje (Switch)
  ├─ audio → Obtén el audio → Descarga el audio → Transcribe audio (OpenAI) ┐
  └─ texto ────────────────────────────────────────────────────────────────┤
Recepcionista IA (Agent + Claude + Memoria + Agenda/Google Calendar + salida estructurada)
  → Prepara la respuesta (Code) → ¿Qué hace? (Switch)
      ├─ ofrecer_horarios → Envía horarios (botones interactivos)
      ├─ reservar → ¿Sigue libre? → ¿Libre? → Crea la cita (Google Calendar) → Guarda ficha (Sheets) → Confirma / ubicación / ocupado
      └─ responder / derivar → Responde / Avisa a la clínica
Cada mañana 08:00 → Citas de mañana + Pacientes nuevos → resumen a la doctora + recordatorios
```

Piezas que valen:

| Pieza | Por qué sirve |
|---|---|
| Prompt del agente (2.672 caracteres) | Define rol, límites ("no inventes precios ni horarios"), urgencias, estilo WhatsApp, campos de salida. |
| Esquema de salida estructurado | `respuesta`, `accion` (`responder`/`ofrecer_horarios`/`reservar`/`derivar`), `botones[{titulo,inicio}]`, `urgente`, `motivo`, `nombre_paciente`, `cita_inicio`. Obliga al modelo a decidir, no a improvisar. |
| `Lee el mensaje` (Code) | Normaliza texto, audio, botones; **embebe la cita en el `id` del botón** (`{"i": inicio, "u": urgente, "m": motivo, "n": nombre}`), así tocar un botón no depende de memoria del modelo. |
| `Prepara la respuesta` (Code) | Sanea títulos a 20 caracteres, deduplica, máximo 3 botones, `id` máximo 256, degrada acciones incompletas a `responder`. |
| Reglas de interfaz WhatsApp | Lista si hay más de 3 opciones; botones si son 2–3. |
| Triage de urgencias + derivación | El agente marca `urgente` y deriva; no diagnostica. |

## 2. Qué hay que reemplazar (no copiar)

| En el workflow | En Alaia |
|---|---|
| `Datos de la clínica` (datos quemados) | Configuración del **tenant**: nombre, dirección, horario, servicios, zona horaria. |
| Herramienta `Agenda` de Google Calendar | `GET /api/v1/tenants/{tenantId}/availability` (slots reales, zona del negocio, sin pasado, sin solape). |
| Crear cita en Google Calendar | `POST /api/v1/tenants/{tenantId}/appointments` (idempotente con `clientRequestId`). |
| Google Sheets "Guarda ficha" | Firestore `customers` bajo `tenantId`, no una hoja por negocio. |
| Memoria en buffer por sesión | Estado de conversación por `tenantId` + teléfono, con retención mínima. |
| `phoneNumberId` / `telefonoClinica` fijos | Mapa `phone_number_id → tenantId` en el backend; el número nunca elige el tenant solo. |
| Prompt con `{{ $('Datos de la clínica')... }}` | Prompt versionado con contexto inyectado por el backend (tenant + herramientas disponibles). |
| IA sin verificación | El agente **propone**; el backend valida disponibilidad, precio y permisos y decide. |

## 3. Contrato de herramientas del agente (propuesto)

Ninguna herramienta recibe `tenantId` del modelo: el backend lo deriva de la conversación (canal + número).

| Herramienta | Endpoint real | Notas |
|---|---|---|
| `consultar_horarios` | `GET /availability?from&to&durationMinutes` | Devuelve máximo ~6 opciones agrupadas por día. |
| `crear_cita` | `POST /appointments` | Requiere confirmación del cliente; `clientRequestId` = id del mensaje o UUID de la conversación. |
| `reprogramar_cita` | `POST /appointments/{id}/reschedule` | Ver task-3. |
| `cancelar_cita` | `POST /appointments/{id}/cancel` | Ya existe. |
| `consultar_servicios` | pendiente (catálogo del tenant) | Para no inventar precios. |
| `consultar_cliente` | pendiente (`customers` por tenant) | Nuevo vs. recurrente con hechos. |
| `derivar_humano` | pendiente (pausa + aviso) | Equivale a `bot_pausado` de Novara, pero por sesión. |

## 4. Límites que se mantienen del diseño original

- El agente nunca inventa disponibilidad, precio ni historial: si no hay herramienta, no responde ese dato.
- Antes de reservar, cancelar o reprogramar pide confirmación explícita.
- Mensajes breves (máx. 3 frases), sin markdown, un emoji como máximo.
- Derivación a persona ante urgencias o fuera de alcance.
- Acciones repetidas no duplican citas (idempotencia en backend).

## 5. Siguiente paso técnico

1. **Disponibilidad y reprogramación en la API** (en curso): base para cualquier agente.
2. **Contrato del agente** con herramientas acotadas y pruebas de conversación con datos ficticios.
3. **Entrada por WhatsApp** con webhook verificado y mapa número → tenant; reutilizar `Lee el mensaje` y `Prepara la respuesta` adaptados a Evolution API o WhatsApp Cloud API.
4. **Audio**: transcripción como la del workflow, pero en el backend (nunca el editor de n8n expuesto).

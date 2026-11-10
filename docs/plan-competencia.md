# Plan de competencia y capas (Aventhra vs Alaia)

**Fecha:** 10 de noviembre de 2026. Referencia: aventhra.online (revisado hoy).

## 1. Qué hace Aventhra (según su sitio)

- Agente IA 24/7 en WhatsApp, Instagram y Messenger con API oficial de Meta.
- Cobra con **Wompi del propio negocio** (conecta su cuenta en 4 pasos, link de pago, confirmación automática).
- Agenda citas y pedidos.
- Onboarding "mágico": pega la URL y la IA lee web/Instagram/Facebook y propone configuración.
- Escalado a humano con pausa del agente y panel para responder.
- Inventario: foto/PDF/CSV de facturas de proveedor → productos y stock.
- Marketing humano (reels, fotos) como servicio aparte.
- Precios: Atención $140.000/mes (lanzamiento $98.000), Atención+Marketing $700.000, Marketing $560.000. Cupos de ~1.200 respuestas/mes, créditos extra.

## 2. Qué ya tiene Alaia

| Función | Estado |
|---|---|
| Webhook WhatsApp firmado, multi-tenant, dedupe | ✅ |
| Modo sandbox/live | ✅ |
| Agente con herramientas y backend autoritativo | ✅ |
| Agenda real, servicios, equipo, comisiones, página pública | ✅ (más que Aventhra en gestión) |
| Panel de plataforma (negocios, planes, suspensión) | ✅ |
| Recordatorios automáticos | ✅ |
| Coexistencia humano-IA + aviso de privacidad | 🔄 en construcción |
| Bandeja de conversaciones | ❌ |
| Onboarding con URL | ❌ |
| Wompi | ❌ |
| Instagram/Messenger | ❌ |
| Inventario/OCR | ❌ |
| Google Calendar | ❌ |

## 3. Capas de construcción (orden recomendado)

**Capa 0 — Piloto en vivo (prioridad absoluta sobre módulos)**
- Hosting que no duerma (keep-alive o plan pago).
- Número registrado en Meta y WhatsApp en modo `live`.
- Documentos legales publicados (privacidad, términos, tratamiento, borrado).
- Con eso el piloto de la barbería queda vendible y valida precios.



**Capa 1 — Conversación usable (en curso)**
- Coexistencia: pausar IA cuando responde una persona.
- Aviso de privacidad automático.
- Bandeja de conversaciones en el panel (ver hilos, responder, pausar IA).
- Notificación al equipo cuando el agente escala.

**Capa 2 — Dinero de entrada (prioridad comercial)**
- Wompi para la **membresía de Alaia**: cobrar planes a los negocios (link/checkout, estado de pago, activación y suspensión automática).
- Prueba de 14 días → pago → plan activo.
- Esta capa es la que genera ingresos; va antes que cualquier extra.

**Capa 3 — Cobro del negocio a su cliente**
- Cada negocio conecta **su cuenta Wompi** (llaves propias) o se generan links de pago por cita/pedido.
- No hay marketplace nativo en Wompi: el dinero debe caer en la cuenta del negocio, no en la de Alaia.

**Capa 4 — Onboarding mágico**
- Pegar URL → scraper (Cheerio) + IA → propuesta de servicios, horarios y tono.
- El dueño revisa y confirma; nunca escribe 20 campos.

**Capa 5 — Calendario real**
- Google Calendar: espejo de la agenda de Alaia (Alaia sigue siendo la fuente de verdad).
- Sincronización de dos vías con control de conflictos.

**Capa 6 — Omnicanal**
- Instagram y Messenger con la API de Meta (requiere cuenta profesional, página vinculada y permisos de la app; revisión de Meta).
- Misma lógica de tenant y coexistencia, distinto canal.

**Capa 7 — Inventario y OCR**
- Productos, stock, proveedores y compras.
- Foto/PDF/CSV de factura → OCR/visión → líneas de compra → stock.
- Solo tiene sentido para negocios que venden productos; no para barbería pura.

## 4. Decisiones y advertencias

- **Escalado humano**: no es una función aparte; es la coexistencia ya diseñada más una notificación. Se resuelve con la Capa 1.
- **Instagram/Messenger** exige trámites con Meta (no solo código). No se promete en la primera venta.
- **OCR de facturas** necesita un modelo con visión (OpenAI/Gemini/Claude) o un OCR pago; DeepSeek no lee imágenes. Hay que definir proveedor y costo por factura.
- **Wompi del negocio**: la cuenta y los papeles son del negocio; Alaia solo envía el link y escucha la confirmación.
- **No copiar el marketing humano**: Alaia es software; meterse en producción de contenido es otro negocio.

## 5. Diferenciación de Alaia

1. **Gestión real del negocio**: agenda, equipo, comisiones, horarios, excepciones, página pública. Aventhra se enfoca en conversación y cobro.
2. **Transparencia**: el agente no es caja negra; cada herramienta es auditable y el backend valida.
3. **Multi-sector**: barbería, spa, uñas, pestañas, cejas, masajes, estética, servicios.
4. **Precio**: entrada más baja para el piloto, con cupos de IA controlados.
5. **Datos del negocio en Firebase del producto**, con aislamiento por tenant y exportables.

## 6. Criterio de prioridad

Cada capa se construye solo si:
1. Desbloquea una venta o evita una cancelación.
2. No requiere trámites externos largos (Meta, bancos).
3. Se puede verificar con pruebas y evidencia.

Orden actual: Capa 1 → Capa 2 → Capa 4 → Capa 3 → Capa 5 → Capa 6 → Capa 7.

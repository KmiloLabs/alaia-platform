# Backlog de funciones de competencia (Aventhra)

**Fecha:** 10 de noviembre de 2026. Estado: registrado, priorizado y **no iniciado** hasta cerrar la Capa 0 (piloto en vivo). Este documento evita que se pierdan los cuatro puntos nuevos.

## Regla de prioridad

Ninguna de estas funciones se construye antes de:
1. Hosting sin sueño.
2. WhatsApp en modo `live` con el número del negocio.
3. Documentos legales publicados.

Motivo: sin eso no hay piloto real, y sin piloto no hay validación de precios ni de uso.

## 1. Escalado humano inteligente

**Qué falta:** notificar al equipo cuando el agente escala o el cliente pide persona.

**Ya existe / en curso:**
- `task-36` (en curso): flag `humanActive`, auto-reanudación 12 h, endpoints `handoff` y `reply`, aviso de privacidad.
- `task-37` (en pausa): bandeja de conversaciones en el panel.

**Falta después del piloto:**
- Notificación al dueño/profesional: WhatsApp al número del negocio, correo o push del panel.
- Detección automática de "caso complicado" (queja, tema sensible, palabras clave) además de "PERSONA".
- Asignación de conversaciones a un profesional específico.

**Dependencias:** `task-36`, `task-37`. **Esfuerzo:** 3–5 días después de la bandeja.

## 2. Cierre de transacciones (pedidos, citas, links de pago)

**Qué ya existe:** citas con servicios, precios, disponibilidad, página pública y agente que agenda.

**Qué falta:**
- **Pedidos** (productos, no solo citas): carrito simple, cantidades, total, estado (pendiente/pagado/entregado).
- **Link de pago por pedido/cita** con la cuenta Wompi del negocio.
- Confirmación automática del pago por webhook de Wompi y cambio de estado.
- Si el negocio cobra por transferencia: adjuntar comprobante y aprobación manual.

**Decisiones:**
- Wompi no tiene marketplace nativo: el dinero debe caer en la cuenta del negocio (llaves propias), no en la de Alaia.
- Para la membresía de Alaia (negocios pagándonos) se usa una cuenta Wompi distinta: la de Alaia. Son dos integraciones separadas.

**Dependencias:** cuenta Wompi del negocio, módulo de productos/pedidos. **Esfuerzo:** 2–3 semanas.

## 3. Omnicanal (WhatsApp + Instagram + Messenger)

**Qué falta:** hoy solo WhatsApp.

**Diseño:** abstraer el canal en una capa `channels/` con interfaz común:
- `receive(normalizedMessage)` → conversación.
- `send(tenantId, conversationId, text)`.
- Cada canal implementa: WhatsApp Cloud API, Instagram Messaging, Messenger Platform.
- El agente y la coexistencia no cambian: reciben el mismo mensaje normalizado y el mismo `tenantId`.

**Requisitos externos (los que frenan):**
- App de Meta con productos Instagram/Messenger.
- Cuenta profesional de Instagram vinculada a una página de Facebook.
- Permisos `instagram_business_manage_messages`, `pages_messaging` y revisión de la app por Meta.
- Cada negocio debe autorizar sus cuentas (OAuth).

**Dependencias:** trámites de Meta. **Esfuerzo:** 3–4 semanas después de permisos.

## 4. Inventario con OCR de facturas

**Qué falta:** todo el módulo.

**Diseño:**
- Colecciones: `products` (nombre, sku, precio, stock, stock mínimo), `suppliers`, `purchases` (fecha, proveedor, total, líneas), `purchaseLines` (producto, cantidad, costo).
- Flujo: foto/PDF/CSV → texto → modelo con visión → JSON de líneas → revisión humana → confirmar → suma stock y actualiza costo promedio.
- Foto/PDF: subida a Cloud Storage (o base64 si es pequeño) + proveedor con visión.
- CSV: parseo directo sin IA.

**Decisión pendiente:** modelo con visión (OpenAI, Gemini o Claude) vs OCR especializado. DeepSeek V3 **no lee imágenes**. Hay que definir costo por factura y límite por plan.

**Alcance:** solo negocios que venden productos (barbería con pomadas, spa con cremas). No es prioridad para agenda pura.

**Dependencias:** proveedor con visión, almacenamiento de archivos, UI de revisión. **Esfuerzo:** 3–4 semanas.

## Orden de ejecución posterior

1. Capa 0: piloto en vivo (en curso).
2. Cerrar `task-36` y `task-37` (escalado usable).
3. **Wompi membresía** (ingreso propio).
4. Onboarding mágico (venta más rápida).
5. Pedidos + Wompi del negocio.
6. Notificaciones de escalado.
7. Instagram/Messenger.
8. Inventario/OCR.

## Señales para decidir cuándo empezar cada una

| Función | Señal para empezar |
|---|---|
| Escalado completo | El piloto recibe mensajes que el agente no puede resolver |
| Wompi membresía | El negocio piloto acepta pagar (aunque sea manual) |
| Onboarding mágico | Hay que configurar 3+ negocios seguidos y duele el tiempo |
| Pedidos | Un cliente pide vender productos, no solo citas |
| Omnicanal | Los clientes escriben por Instagram y no por WhatsApp |
| Inventario/OCR | El negocio maneja stock y facturas de proveedor |

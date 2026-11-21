# ESTADO DE ALAIA — fuente única (19 nov 2026)

**Cómo se verificó:** `git log` (último commit `b3e1afb`, 17 nov), 269 pruebas de API en verde (`npm --workspace @alaia/api run test`), y `/health` en vivo:
`https://alaia-ophy.onrender.com/health` → `{"status":"ok","service":"alaia-api"}`.

**Regla:** este documento manda sobre `README.md` y `docs/stack-actual.md` cuando se contradigan (esos son del 5–6 nov; el código avanzó hasta el 17 nov).

---

## 1. Qué está construido y funcionando

| Módulo | Estado | Evidencia en código |
|---|---|---|
| Identidad, negocios (tenant), roles, invitaciones | ✅ | `auth-middleware`, `tenant-routes`, `invitation-*` |
| Agenda: crear, listar, cancelar, reprogramar | ✅ | `appointment-*` |
| Disponibilidad real por horario y zona horaria | ✅ | `availability`, `timezone`, `business-profile` |
| Sin doble reserva + idempotencia | ✅ | `appointment-conflicts`, pruebas |
| Panel del dueño: agenda, clientes, servicios, equipo, horarios | ✅ | `apps/web/app.js` (vistas `renderAgenda`, `renderCustomers`, `renderServices`, `renderProfessionals`) |
| Comisiones y liquidaciones | ✅ | `settlement*` |
| Resumen financiero por cita (ingresos) | ✅ | `dashboard*` |
| Página pública de reservas `/b/<slug>` | ✅ | `public-booking`, `renderPublicPageCard` |
| Agente IA con herramientas de agenda | ✅ | `agent/*` (DeepSeek activo, proveedores configurables, modo mock) |
| WhatsApp Cloud API: webhook firmado, sandbox/live | ✅ | `whatsapp*` (código listo) |
| Aviso de privacidad, coexistencia humano–IA, bandeja de conversaciones | ✅ | commits `bb3f99c`, `1914e17` |
| Recordatorios por WhatsApp (config + tarea programada) | ✅ | `reminder-*` |
| Páginas legales públicas (`/legal`) | ✅ | commit `e688005` |
| Consola de plataforma: negocios, planes/trial, proveedores IA, WhatsApp | ✅ | `platform-*`, `trial` |
| Despliegue: un servicio sirve panel + API | ✅ | `render.yaml`, `docs/despliegue.md` |

**Despliegue actual:** Render plan gratuito, un solo servicio, Firestore real `alaia-3f637`.
**Pruebas:** 269 de API en verde. `npm run verify` (end-to-end) requiere emuladores y API arrancados.

---

## 2. Qué falta de lo que se planeó

| Falta | Impacto hoy | Prioridad |
|---|---|---|
| **Número real de WhatsApp registrado en Meta** (verificación de empresa 1–3 días) | Sin esto el piloto no puede usar el canal real | 🔴 Bloquea piloto |
| **Plantilla `recordatorio_cita` aprobada por Meta** (1–3 días) | Recordatorios fuera de 24 h no entregan | 🔴 Bloquea piloto |
| **Inventario / productos / ventas** (Capa 4) | No se descuentan existencias ni se registra venta de productos | 🟡 Postergable en barbería |
| **Pagos / suscripciones (Wompi)** | No se puede cobrar automático; se cobra manual | 🟡 Después del primer cliente |
| **Dominio propio** | Se usa `alaia-ophy.onrender.com` | 🟡 Antes de vender |
| **Audio/voz en WhatsApp** | Solo se procesa texto entrante | ⚪ Evolución posterior |
| **Google Calendar opcional** | No hace falta: la agenda de Alaia es la fuente de verdad | ⚪ Descartado por ahora |
| **Cold start de Render** (~15 min sin uso → 30–60 s de espera) | Aceptable en piloto; molesto en producción | 🟡 Migrar a Cloud Run al cobrar |

---

## 3. Los 5 bloqueos reales para probar con la barbería

1. **Número de WhatsApp dedicado** (chip nuevo, no el de NOVARA) + app en Meta + verificación de empresa. Es el camino crítico: empieza hoy, tarda días en Meta, no en tu código.
2. **Plantilla de recordatorio** aprobada (se puede pedir en paralelo).
3. **Dominio**: decisión de compra (~USD 12–15/año `.com`; `.co` ~USD 20–30) — se conecta a Render en 10 minutos.
4. **Primer negocio cargado**: la barbería con sus servicios, precios, horarios y profesionales.
5. **Cobro manual** listo (Nequi/transferencia) mientras no exista Wompi.

---

## 4. Ruta al dinero (orden recomendado)

- **Etapa A — Piloto gratis con la barbería (2–4 semanas).** Un negocio, uso real, incidencias registradas. Objetivo: demostrar que la agenda se llena sin que el dueño conteste WhatsApp.
- **Etapa B — Primeros 3 negocios pagando, cobro manual.** Precio mensual definido, sin pasarela. Objetivo: validar que alguien paga antes de construir cobros.
- **Etapa C — Wompi + planes + landing comercial.** Aquí sí se automatiza el cobro y se abren registros públicos.
- **Etapa D — Cloud Run + dominio propio + inventario.** Solo cuando haya clientes pagando y el arranque en frío estorbe.

**Por qué este orden:** construir pagos e inventario antes de tener un negocio real usándolo es tiempo invertido en features que nadie ha pedido todavía.

---

## 5. Qué comprar y cuándo

| Compra | Cuándo | Costo aproximado |
|---|---|---|
| **Dominio** | Antes de presentar la barbería (semana 1) | 12–30 USD/año |
| **Chip / número WhatsApp** | Ya (bloquea todo) | 5–15 USD una vez |
| **Hosting API + panel** | Ya resuelto | Render gratis |
| **Firebase** | Ya resuelto | Plan gratuito (alcanza el piloto) |
| **IA DeepSeek** | Ya con clave | Por consumo (bajo) |
| **VPS Contabo** | ⚠️ Era de NOVARA. Si lo sigues pagando y NOVARA está archivado, cancelarlo o reutilizarlo para Alaia en Etapa C | Evita gasto fijo mensual |
| **Cloud Run** | Etapa D, cuando haya pago | Por uso |

**No compres** servidor nuevo, Kubernetes, ni hosting compartido: el despliegue actual ya funciona.

---

## 6. Riesgos abiertos

1. **Documentación desactualizada** (README y `stack-actual.md` del 5–6 nov describen un estado anterior al código). Solución: este `ESTADO.md` como fuente única.
2. **`apps/web/app.js` con 7.807 líneas de JS puro.** No refactorizar ahora; si crece, dividir por vistas en la Etapa C.
3. **Secretos** en `.env.real` local. Nunca a Git ni al chat.
4. **Dependencia de Render gratis**: el servicio duerme. Aceptable en piloto, no en venta.
5. **Dependencia de clave DeepSeek**: si se agota o cambia de precio, el agente deja de responder.

---

## 7. Próximos 5 pasos (en orden)

1. Decidir y comprar el dominio (30 min).
2. Iniciar el trámite de WhatsApp en Meta y pedir la plantilla de recordatorio (hoy, porque tarda días).
3. Definir precio del plan para barberías y la forma de cobro manual.
4. Decidir explícitamente: inventario **fuera** del piloto (recomendado) o mínimo (entradas/salidas de productos).
5. Actualizar `README.md` a este estado y archivar NOVARA (repo y VPS).

# Auditoría del documento maestro contra el código real

**Fecha:** 6 de noviembre de 2026 · **Método:** lectura del repositorio, pruebas ejecutadas y una conversación real con DeepSeek. Solo hechos comprobados; lo que no está probado va marcado como pendiente o hipótesis.

## 1. Veredicto

El documento maestro es **correcto como visión y como reglas de trabajo**. Lo que quedó desactualizado es su estado técnico: dice "arquitectura y código pendientes de auditoría" y en realidad las fases 2, 4 (parcial), 5 (parcial) y 8 (solo la parte de IA) ya están construidas, probadas y en GitHub.

No hay que reescribir nada. Hay que **actualizar el estado, corregir seis supuestos y seguir por capas**.

## 2. Estado real comprobado

| Componente | Estado | Evidencia |
|---|---|---|
| Autenticación (Firebase Auth) | hecho | registro/login en panel y API |
| Multi-tenant: tenants, slugs, membresías | hecho | aislamiento probado entre dos negocios |
| Aislamiento backend (tenant de la ruta) | hecho | 53 comprobaciones e2e, cruces dan 403/404 |
| Agenda: crear, listar, cancelar | hecho | panel + API + pruebas |
| Disponibilidad por zona horaria del negocio | hecho | conversión con `Intl`, pruebas unitarias |
| Reprogramación con no-doble-reserva | hecho | transacción Firestore, 409 probado |
| Idempotencia (`clientRequestId`) | hecho | prueba e2e |
| Historial de eventos (append-only) | hecho | `.../events` |
| Panel real (login, negocio, agenda, configuración) | hecho | Chrome, 12/12 y 24/24 |
| Reprogramar y chips de horarios en el panel | hecho | commit `6ef8333` |
| Agente IA con proveedor/modelo por negocio | hecho | DeepSeek real probado |
| Herramientas del agente sobre la agenda real | hecho | disponibilidad, crear, reprogramar, cancelar |
| Configuración del agente (tono, instrucciones, prueba) | hecho | panel y API |
| Superadministrador de ALAIA | **no existe** | no hay rol ni panel |
| Servicios y categorías | **no existe** | el agente usa texto libre y precio 0 |
| Horarios configurables por negocio | **no existe** | horario fijo en código |
| Empleados / profesionales / sedes | **no existe** | una sola agenda por negocio |
| Clientes (CRM) | **no existe** | solo `customerName` como texto |
| Ventas, gastos, comisiones, liquidaciones | **no existe** | — |
| Roles y permisos | **no existe** | solo dueño |
| Planes, suscripciones, pagos | **no existe** | — |
| Página pública del negocio | **no existe** | `tenantSlugs` ya preparado |
| WhatsApp Cloud API | **no existe** | decisión escrita en `decision-whatsapp.md` |
| Auditoría de acciones sensibles | **no existe** | — |
| Despliegue a producción | **no existe** | todo en emuladores |

Pruebas actuales: **84 unitarias** y **53 comprobaciones end-to-end**.

## 3. Dónde el documento se equivoca o quedó viejo

1. **Stack del frontend.** El documento propone React + TypeScript + Tailwind. Lo real es JavaScript con Vite, sin framework. No es un error de visión, pero **no se debe reescribir por moda**: el panel funciona y está probado.
2. **Backend.** El documento duda entre Cloud Functions y Cloud Run. Lo real es un servidor Express. La decisión de despliegue sigue abierta (recomendación en la sección 7).
3. **Estado.** "Arquitectura y código pendientes de auditoría" ya no aplica: esta auditoría lo cubre.
4. **Fase 0** ("no modificar archivos") se cumplió hace días; el proyecto está en ejecución.
5. **Costos de IA por negocio.** El documento no los menciona. Sin topes, un negocio puede consumir sin límite. Hay que añadir consumo medido y límite por plan.
6. **Horarios.** El documento los da por configurables en la fase 4, pero hoy están **fijos en código** (9:00–18:00, lunes a sábado, bloques de 30, domingo cerrado). Es la deuda más urgente para ser multisectorial: un spa no abre a las 9:00.
7. **Precios.** El documento acierta al no fijarlos sin costos reales. Mantener esa regla.

## 4. Riesgos técnicos, ordenados por impacto

1. **Horario fijo en código** (`apps/api/src/availability.js`): cualquier negocio con otro horario queda mal atendido por el agente y por el panel.
2. **Sin catálogo de servicios**: el agente crea citas con `priceCOP: 0` y duración 45; no puede cotizar ni respetar la duración real.
3. **Sin clientes**: el historial no existe; el mismo cliente se duplica en cada cita. Sin esto no hay CRM ni fidelización.
4. **Sin superadministrador**: no puedes crear, suspender ni supervisar negocios, ni ver consumo. Es el control que pediste.
5. **Sin tope de consumo de IA**: un negocio puede agotar el saldo de DeepSeek.
6. **Sin roles**: cualquier miembro del negocio puede todo, incluidas finanzas.
7. **CORS fijo a `localhost:5173`**: correcto en desarrollo, debe ser configurable en producción.
8. **Sin auditoría**: el documento la exige y no existe registro de acciones sensibles.
9. **`app.js` monolítico** (73 KB en un archivo): funciona, pero cada módulo nuevo lo hace más frágil.
10. **Sin despliegue**: los datos viven en el emulador y son efímeros. Nada de esto está en producción.
11. **Sin backup, retención ni verificación de correo** en producción.

## 5. Qué conservar (no tocar)

- El **tenant sale siempre de la ruta validada**, nunca del cuerpo ni del modelo.
- **Firestore con transacciones** para la no-doble-reserva.
- El agente usa **herramientas del backend**; la IA no es autoridad sobre reservas ni precios.
- **Proveedores intercambiables** con un registro y configuración por negocio.
- Las **pruebas** (84 + 53) como red de seguridad de cada capa.
- El **diseño del panel**: limpio, accesible y coherente.

## 6. Qué corregir antes de seguir creciendo

| Deuda | Por qué ahora |
|---|---|
| Horarios por negocio (`schedules`) | sin esto el agente miente con horarios de spa |
| Servicios con precio y duración | sin esto el agente cotiza en 0 |
| Clientes vinculados a citas | sin esto no hay historial ni CRM |
| Superadmin + consumo | el control que pediste y la base del cobro |
| Tope de IA por negocio | proteger el saldo y el negocio |
| Roles (dueño, recepción, profesional) | el documento lo exige y hoy no existe |

## 7. Arquitectura objetivo recomendada

- **Mantener** Express + Firestore. No hay razón para microservicios ni Kubernetes.
- **Producción:** API en **Cloud Run**, panel en **Firebase Hosting**, Firestore real, emuladores en desarrollo. Es el camino más corto desde lo que ya funciona y el más barato.
- **Web:** mantener JavaScript modular. Pasar a React solo si el panel llega a varias vistas complejas; no antes.
- **WhatsApp:** Cloud API oficial (ver `decision-whatsapp.md`).
- **n8n:** solo notificaciones y automatizaciones auxiliares; nunca reservas, pagos ni permisos.
- **Costos:** medir consumo por negocio y aplicar tope mensual por plan.

## 8. Plan revisado por capas

Cada capa termina con pruebas, `npm run verify` y commit.

| Capa | Contenido | Por qué en este orden |
|---|---|---|
| **A** | Horarios por negocio + catálogo de servicios + clientes | son los datos que el agente necesita para no inventar precios ni horas |
| **B** | Superadmin: crear/suspender negocios, plan, consumo, topes | te da el control y habilita el cobro |
| **C** | Página pública por negocio (slug ya existe) | se puede vender ya; es el destino de la pauta |
| **D** | WhatsApp Cloud API (webhook, mapa número→negocio, plantillas) | canal principal, pero depende de la página para enlaces y plantillas |
| **E** | Finanzas: ventas, gastos, comisiones, liquidaciones | necesita servicios y clientes de la capa A |
| **F** | Planes, suscripciones y pagos a ALAIA | necesita superadmin de la capa B |
| **G** | Roles, permisos y auditoría | transversal; al final de las capas de datos |

**Recomendación:** hacer **A** y luego **B**. A es corta (1–2 días) y arregla lo que hoy hace al agente cotizar mal. B es lo que pediste como control de la plataforma.

## 9. Tres decisiones para aprobar

1. **Producción:** Cloud Run + Firebase Hosting + Firestore real. Alternativa: seguir solo en local y posponer el despliegue.
2. **Orden:** capa A (horarios, servicios, clientes) antes que capa B (superadmin). La alternativa es superadmin primero y el agente cotizando en 0 una semana más.
3. **Cobro:** plan con IA incluida y tope mensual por negocio (recomendado), o consumo libre con recarga.

## 10. Sobre el saldo de DeepSeek

La conversación de prueba consumió unos pocos miles de tokens. No puedo ver tu saldo ni los precios vigentes desde aquí: revísalos en tu panel de DeepSeek. Para desarrollo no deberías necesitar recargar; para producción sí hay que definir el tope por negocio de la capa B.

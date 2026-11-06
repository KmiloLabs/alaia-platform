# Radar de competencia y referencias abiertas

**Fecha:** 6 de noviembre de 2026. **Método:** precios y funciones consultados en sitios oficiales; estrellas de GitHub consultadas en su API. Lo que no pude verificar queda marcado como *pendiente*.

## 1. Competencia directa en Colombia

| Producto | Precio verificado | Fuerte en | Débil en (para nosotros) |
|---|---|---|---|
| **Blyssbook** | 34.900 / 66.900 / 154.900 COP/mes | Página de reservas, comisiones y nómina, caja, clientes, WhatsApp en bandeja; IA en el plan Professional | La IA responde, pero no cotiza con catálogo propio del negocio ni agenda con herramientas auditables |
| **AgendaPro** | *pendiente de verificar precio exacto* | Marca conocida, agenda y reservas, reportes | Menos foco en IA conversacional |
| **Beunik** (Medellín) | *pendiente* | App propia para negocios de belleza (App Store / Play Store), reservas | Producto de app, no de plataforma multi-negocio con panel para el dueño del SaaS |
| **Fresha / Booksy** | Comisión por cita en algunos casos | Marketplace de clientes (te traen demanda) | Cobran comisión por cita y el negocio no es dueño de su canal |

**Oportunidad:** los competidores ya tienen agenda y reservas (lo básico). Ninguno ofrece al dueño del SaaS un **panel de plataforma** para supervisar a todos sus negocios con suspensión, planes y consumo, ni un agente que **cotice con los precios y horarios reales del negocio** usando herramientas auditables.

## 2. Funciones que ellos tienen y nosotros todavía no

Ordenadas por impacto comercial:

1. **Recordatorios automáticos por WhatsApp** (todos los competidores). Es el retorno de inversión más claro: reduce inasistencias. Nosotros ya tenemos el canal en preparación.
2. **Anticipos o depósitos** para citas (Blyssbook Professional). Bajan el no-show en servicios caros.
3. **Bandeja de conversaciones** con estado (abierta/pendiente/resuelta), asignación a una persona y etiquetas. Cuando el agente deriva a un humano, alguien tiene que atender.
4. **Paquetes, membresías y fidelización** (Blyssbook Professional).
5. **Caja, comprobantes e inventario** (Blyssbook Starter).
6. **Dominio propio** para la página pública (Blyssbook Enterprise).
7. **Multi-sede** (Blyssbook Enterprise).
8. **Campañas de correo** (Blyssbook Professional).

## 3. Lo que nosotros tenemos y ellos no

- Agente que **consulta servicios, precios, disponibilidad y crea la cita** con herramientas del backend (no inventa).
- **Plantillas por sector** que precargan servicios con precios.
- **Panel de plataforma** propio: crear/suspender negocios, planes, consumo de IA, proveedores de IA con claves cifradas.
- **Comisiones configurables por profesional** (porcentaje, fijo, alquiler, mixto) con liquidación por rango.
- Multi-sector desde el mismo código (barbería, spa, uñas, pestañas, cejas, masajes, estética).

## 4. Referencias abiertas (estrellas verificadas)

| Repositorio | Estrellas | Qué sirve | Qué no copiar |
|---|---|---|---|
| [cal.com](https://github.com/calcom/cal.com) | **49.752** | Patrón de página de reserva por enlace, disponibilidad por persona, zonas horarias, reprogramación | Su stack (Next.js + Prisma + Postgres): reescribir Alaia sería perder lo que funciona |
| [chatwoot](https://github.com/chatwoot/chatwoot) | **39.002** | Patrón de bandeja omnicanal: estados de conversación, asignación a humano, etiquetas, respuestas guardadas | Ruby/Rails y su modelo completo; tomamos el concepto, no el código |
| [easyappointments](https://github.com/alextselegidis/easyappointments) | **4.482** | Modelo servicios/profesionales/clientes y sincronización con Google Calendar | PHP antiguo y licencia GPL; solo como referencia de dominio |

**Decisión:** copiamos **patrones**, no proyectos. No reescribimos Alaia en otro stack.

## 5. Qué haremos con esto (prioridad)

1. **Recordatorios por WhatsApp** cuando el canal esté en modo `live`.
2. **Bandeja de conversaciones** inspirada en Chatwoot: lista de conversaciones, estado, "atender persona" (handoff) y respuestas guardadas.
3. **Anticipos** para servicios de precio alto (integración con pasarela).
4. **Paquetes/membresías** cuando el piloto lo pida.
5. **Multi-sede** cuando haya un cliente que lo necesite.

Lo que **no** haremos: marketplace con comisión por cita (canibaliza el negocio), app nativa (la web responsive alcanza), e inventario completo antes de tener clientes pagando.

## 6. Fuentes

- Blyssbook precios Colombia: https://blyssbook.com/es/precios?pais=CO
- Gestabiz (barberías): https://gestabiz.com/co/para/barberias
- AgendaPro en Capterra: https://www.capterra.co.uk/software/218709/agendapro
- Beunik (app de negocios): https://apps.apple.com/se/app/beunik-pro-negocios-de-belleza/id1620465162
- Estrellas: API de GitHub consultada el 6/11/2026 (cal.com, chatwoot, easyappointments).

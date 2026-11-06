# Plan comercial: precios y lo que falta para vender

**Estado:** propuesta para validar con el piloto. Los precios del competidor son reales (consultados el 6 de noviembre de 2026); los nuestros son una hipótesis a probar, no un compromiso.

## 1. Referencia real del mercado (Colombia)

[Blyssbook](https://blyssbook.com/es/precios?pais=CO), competidor directo en Colombia, cobra:

| Plan | Precio | Incluye |
|---|---|---|
| Starter | **34.900 COP/mes** (349.000/año) | Página de reservas, 5 profesionales, 200 citas/mes, comisiones, caja, clientes, WhatsApp en bandeja |
| Professional | **66.900 COP/mes** (669.000/año) | 15 profesionales, 1.000 citas/mes, **IA en WhatsApp/Instagram/Messenger**, recordatorios, anticipos |
| Enterprise | **154.900 COP/mes** | 10 sucursales, ilimitado, soporte prioritario |

Reglas que usan y que conviene copiar: **14 días gratis sin tarjeta**, sin comisión por cita, sin permanencia, y descuento por pago anual (2 meses gratis).

Otros del mercado: [Gestabiz](https://gestabiz.com/co/para/barberias), [AgendaPro](https://www.capterra.co.uk/software/218709/agendapro).

## 2. Propuesta de planes para ALAIA

| Plan | Precio | Para quién | Incluye |
|---|---|---|---|
| **Prueba** | $0 por 14 días | Todos | Todo el producto, sin tarjeta |
| **Básico** | **$39.900/mes** ($399.000/año) | Independientes y 1 sede | Agenda, página pública, servicios, clientes, equipo hasta 5, comisiones y liquidación, agente IA con tope de 300 mensajes/mes |
| **Pro** | **$79.900/mes** ($799.000/año) | Salones con movimiento | Todo lo del Básico + equipo hasta 15, **IA en WhatsApp**, recordatorios, 1.000 citas/mes, topes de IA ampliados |
| **Premium** | **$159.900/mes** | Varias sedes | Sedes ilimitadas, dominio propio, soporte prioritario, topes a medida |

Notas:
- Sin comisión por cita y sin permanencia (igual que el mercado).
- La IA y WhatsApp tienen **costo variable** (tokens de DeepSeek + conversaciones de Meta): cada plan lleva **tope mensual** y el excedente se cobra o se bloquea. Esto evita el error de vender IA "ilimitada" y perder dinero.
- **Para el piloto:** la barbería de tu amigo entra en Prueba y se le deja el plan Pro sin costo durante la validación.

## 3. Lo que falta para vender (en orden)

### Antes de la primera venta
1. **Despliegue real**: API en Cloud Run, panel en Firebase Hosting, Firestore en producción, dominio y HTTPS. Sin esto no se puede cobrar ni mostrar.
2. **Página pública de cada negocio**: es el producto visible y el argumento de venta.
3. **Planes y límites aplicados**: el campo `plan` ya existe; falta hacer cumplir topes (profesionales, citas/mes, mensajes de IA) y mostrar consumo.
4. **Términos, privacidad y tratamiento de datos**: obligatorio en Colombia (Ley 1581 de 2012) y requisito de Meta para WhatsApp. Sin esto no se puede pautar ni pedir datos de clientes.
5. **Pagos de suscripción**: pasarela colombiana (Wompi/Bold/MercadoPago), cobro recurrente y facturación.

### Primera semana de operación
6. **Alta guiada**: plantillas por sector (hecho), lista de configuración (en cola), demo con datos de ejemplo.
7. **Soporte mínimo**: canal de contacto, guía rápida y videos de 2 minutos.
8. **Métricas del negocio**: activación (negocios que llegan a su primera cita) y retención.

### Después (con clientes pagando)
9. **Google Calendar** (integración opcional).
10. **Facturación electrónica** con proveedor autorizado (DIAN), cuando el cliente tenga RUT.
11. **Recordatorios automáticos** por WhatsApp (reduce inasistencias: principal retorno de la inversión para el negocio).

## 4. Cómo se vende (mensaje)

- **Problema**: el barbero pierde citas por WhatsApp: mensajes sin responder, dobles reservas y clientes que no llegan.
- **Promesa**: "Tu WhatsApp atiende, agenda y cobra solo; tú solo cortas."
- **Prueba**: agente IA con la agenda real, página pública, comisiones y caja en un panel.
- **Riesgo cero**: 14 días gratis, sin tarjeta, sin permanencia.
- **Diferenciador frente a Blyssbook/Gestabiz**: agente IA propio que cotiza con **tus** precios y **tus** horarios, y panel de dueño de plataforma para ti.

## 5. Decisiones pendientes del fundador

1. Precio final de cada plan (arriba hay una propuesta).
2. Qué pasa al vencer la prueba: ¿bloqueo total o modo lectura?
3. ¿Se cobra el excedente de IA o se bloquea?
4. Pasarela de pago a usar.

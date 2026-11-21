# Alaia

Plataforma SaaS multiempresa para negocios de servicios. Su agente atiende las conversaciones y tareas repetitivas con clientes para ahorrar tiempo; el equipo usa un panel central de agenda, clientes, ventas e inventario.

## Estado

La **fuente única de verdad** es [ESTADO.md](ESTADO.md) (actualizado el 19 de noviembre de 2026). Si algo se contradice con este README o con documentos viejos, manda ESTADO.md.

Resumen:

- Producto **desplegado**: panel + API en `https://alaia-ophy.onrender.com` (Firebase real).
- Un negocio de prueba con datos reales (AraanBarbershop) y su página pública `/b/araanbarbershop`.
- WhatsApp Cloud API: **código completo** (webhook firmado, multi-negocio, sandbox/live, coexistencia humano–IA, aviso de privacidad, bandeja). Falta el trámite del número en Meta.
- Recordatorios, legales publicados (`/legal`), panel de plataforma y página pública: funcionando.
- Pendiente: pago de planes (Wompi), onboarding automático con URL, cola durable de mensajes, omnicanal, inventario.
- Documentos históricos (planos viejos, n8n, decisiones descartadas): [docs/historial/](docs/historial/).

## Arranque local

Requisitos: Node.js ≥ 22 y Java ≥ 11 (el emulador de Firestore lo necesita).

```bash
npm install
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
```

Tres terminales desde la raíz del repositorio:

1. `npm run emulators` — Auth en `127.0.0.1:9099`, Firestore en `127.0.0.1:8081`, UI en `http://127.0.0.1:4000`.
   (Firestore usa **8081**: en esta máquina el 8080 lo ocupa Evolution API.)
2. `npm run dev:api` — API en `http://localhost:3001`.
3. `npm run dev:web` — panel en `http://localhost:5173`.

Si el equipo tiene el JDK 21 portátil, `scripts/start-local.ps1` abre las tres ventanas con el `JAVA_HOME` correcto y el orden adecuado.

La configuración de ejemplo apunta al proyecto ficticio `demo-alaia`. **No cambies esa configuración a `novara-bot`** ni a ningún proyecto real; Alaia requiere un proyecto Firebase independiente antes de usar servicios reales.

## Pruebas

```bash
npm --workspace @alaia/api run test   # pruebas puras de API y agente (209)
npm run verify                        # end-to-end contra emuladores + API (120 comprobaciones)
```

`npm run verify` crea dos cuentas y dos negocios ficticios y comprueba, entre otras cosas: aislamiento entre negocios (lectura y escritura cruzadas), no doble reserva, idempotencia, cancelación, disponibilidad, reprogramación y el agente configurable con el proveedor `mock`. Requiere emuladores y API en marcha.

El proveedor `mock` (solo desarrollo) se habilita con `AGENT_ENABLE_MOCK=true` y permite probar el agente sin claves ni gasto. Para usar un proveedor real, añade su clave en `.env` (`DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` o `GEMINI_API_KEY`), reinicia la API y el proveedor aparecerá habilitado en el panel.

## Documentos

- `docs/corte-agenda-panel-real.md`: contrato del corte de agenda (rutas, reglas, criterios de aceptación).
- `docs/corte-agente-configurable.md`: contrato del agente (proveedores, configuración por negocio, herramientas).
- `docs/decision-whatsapp.md`: por qué ALAIA usa WhatsApp Cloud API oficial y Selene sigue con Evolution.
- `docs/auditoria-documento-maestro.md`: estado real del código frente al documento maestro, riesgos y plan revisado.
- `docs/decision-whatsapp.md`: por qué Alaia usa WhatsApp Cloud API oficial y no Evolution API.
- `docs/agente-recepcion-n8n.md`: qué se reutiliza del recepcionista IA de n8n y cómo se conecta a Alaia.
- `docs/arquitectura.md`: arquitectura, seguridad, costos y escalabilidad.
- `docs/plano-y-reglas-codex.md`: roadmap por capas e instrucciones para agentes de código.
- `apps/web/`: panel real (acceso, negocio activo, agenda, ingresos).
- `apps/api/`: identidad, tenant y agenda (`/api/v1`).
- `docs/capa-1-identidad-tenant.md`: alcance y rutas de la primera capa de backend.
- `docs/n8n-recepcionista-empresarial.md`: auditoría del prototipo dental y próximos pasos del flujo n8n.
- `infra/n8n/alaia-reception-v1.json`: plantilla n8n, sin credenciales ni efectos de negocio.
- `infra/n8n/workflow-contract.test.js`: pruebas locales del contrato y de las propuestas seguras.

## Principios

- Un producto central multi-tenant; cada registro de negocio se separa por `tenantId` y se autoriza en el backend.
- La agenda y las reglas críticas pertenecen al backend de Alaia.
- Integraciones (WhatsApp, pagos, IA, voz y automatización) se conectan mediante adaptadores reemplazables.
- No incluir secretos en Git. Configuración local va en `.env` ignorado por Git.
- No modificar ni copiar flujos de Novara sin auditoría y autorización específica.

# Alaia

Plataforma SaaS multiempresa para negocios de servicios. Su agente atiende las conversaciones y tareas repetitivas con clientes para ahorrar tiempo; el equipo usa un panel central de agenda, clientes, ventas e inventario.

## Estado

Corte actual (**panel real con citas guardadas**, 5 de noviembre de 2026): el panel ya no es una demostración. Tiene acceso con correo y contraseña (Firebase Auth), creación y selección de negocio, y una agenda que crea, lista y cancela citas **persistidas** en Firestore con aislamiento por `tenantId`, zona horaria del negocio, prevención de doble reserva e idempotencia. La API también calcula **disponibilidad real** según el horario del negocio y permite **reprogramar** citas: es la base para que el agente consulte horarios en vez de inventarlos.

Estado por capas del [plano técnico](docs/plano-y-reglas-codex.md):

- **Capa 1 (identidad y tenant):** API y pantalla de acceso funcionando contra emuladores. Pendiente: invitaciones, verificación de correo, consola de plataforma.
- **Capa 5 (agenda y reservas):** citas, disponibilidad y reprogramación listas en backend; el panel crea, lista y cancela. Pendiente: reprogramar desde el panel, página pública de reservas y reglas de asignación.
- **Resto de capas:** documentadas, no implementadas. WhatsApp, IA, pagos e inventario siguen fuera de este corte.
- **n8n:** la plantilla de recepción multiempresa existe en `infra/n8n/` como arnés de contrato; sigue inactiva y no es el agente final. El workflow real `Recepcionista epresarial IA` ya está analizado en [docs/agente-recepcion-n8n.md](docs/agente-recepcion-n8n.md).

Todo se prueba con datos ficticios en emuladores locales. No hay despliegue ni datos reales de clientes.

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
npm --workspace @alaia/api run test   # pruebas puras de zona horaria y validación (28)
npm run verify                        # end-to-end contra emuladores + API (26 comprobaciones)
```

`npm run verify` crea dos cuentas y dos negocios ficticios y comprueba, entre otras cosas: aislamiento entre negocios (lectura y escritura cruzadas), no doble reserva, idempotencia, cancelación y validaciones. Requiere emuladores y API en marcha.

## Documentos

- `docs/corte-agenda-panel-real.md`: contrato del corte actual (rutas, reglas, criterios de aceptación).
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

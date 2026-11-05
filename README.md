# Alaia

Plataforma SaaS multiempresa para negocios de servicios. Su agente atiende las conversaciones y tareas repetitivas con clientes para ahorrar tiempo; el equipo usa un panel central de agenda, clientes, ventas e inventario.

## Estado

Fase inicial: prototipo visual del panel, API inicial de identidad/tenant y plantilla limpia para ensayar el contrato de recepción. La plantilla de n8n está en `infra/n8n/alaia-reception-v1.json`; todavía requiere importarse como workflow nuevo y verificarse en la instancia correcta. La copia anterior de adaptación contiene el gráfico dental más un intento añadido encima: está inactiva, no debe publicarse y no se borró. El prototipo dental original sigue intacto. El panel usa datos de muestra; Araan es un piloto futuro.

## Abrir el prototipo

Abre `apps/web/index.html` en un navegador moderno. Puedes cambiar la fecha, revisar ingresos de muestra por día/semana/mes, ver el perfil del profesional y agregar citas de demostración; al recargar, los cambios desaparecen.

## API local (emuladores)

1. Copia `.env.example` a `.env` en la raíz.
2. Ejecuta `npm install`.
3. En una terminal ejecuta `npm run emulators`.
4. En otra terminal ejecuta `npm run dev:api`.
5. La comprobación de salud local responde en `http://localhost:3001/health`.

La configuración de ejemplo apunta al proyecto ficticio `demo-alaia` y a emuladores locales. **No cambies esa configuración a `novara-bot`**; Alaia requiere un proyecto Firebase independiente antes de usar servicios reales.

## Documentos

- `docs/arquitectura.md`: arquitectura, seguridad, costos y escalabilidad.
- `docs/plano-y-reglas-codex.md`: roadmap por capas e instrucciones para agentes de código.
- `apps/web/`: prototipo del panel para el dueño, sin conexión a servicios externos.
- `apps/api/`: verificación de token, creación de negocio y resolución de membresía tenant.
- `docs/capa-1-identidad-tenant.md`: alcance y rutas de la primera capa de backend.
- `docs/n8n-recepcionista-empresarial.md`: auditoría del prototipo dental y próximos pasos para crear el flujo en la instancia correcta.
- `infra/n8n/alaia-reception-v1.json`: plantilla n8n nueva, sin credenciales ni efectos de negocio.
- `infra/n8n/workflow-contract.test.js`: pruebas locales del contrato y de las propuestas seguras.

## Principios

- Un producto central multi-tenant; cada registro de negocio se separa por `tenantId` y se autoriza en el backend.
- La agenda y las reglas críticas pertenecen al backend de Alaia.
- Integraciones (WhatsApp, pagos, IA, voz y automatización) se conectan mediante adaptadores reemplazables.
- No incluir secretos en Git. Configuración local va en `.env` ignorado por Git.
- No modificar ni copiar flujos de Novara sin auditoría y autorización específica.

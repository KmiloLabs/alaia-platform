# Alaia

Plataforma SaaS multiempresa para negocios de servicios: barberías, peluquerías, spas y otros sectores configurables.

## Estado

Fase inicial: arquitectura y estructura del repositorio. No contiene secretos, credenciales, flujos de producción ni código tomado de Novara.

## Documentos

- `docs/arquitectura.md`: arquitectura, seguridad, costos y escalabilidad.
- `docs/plano-y-reglas-codex.md`: roadmap por capas e instrucciones para agentes de código.

## Principios

- Un producto central multi-tenant; cada registro de negocio se separa por `tenantId` y se autoriza en el backend.
- La agenda y las reglas críticas pertenecen al backend de Alaia.
- Integraciones (WhatsApp, pagos, IA, voz y automatización) se conectan mediante adaptadores reemplazables.
- No incluir secretos en Git. Configuración local va en `.env` ignorado por Git.
- No modificar ni copiar flujos de Novara sin auditoría y autorización específica.

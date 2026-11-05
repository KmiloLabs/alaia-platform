# Alaia

Plataforma SaaS multiempresa para negocios de servicios: barberías, peluquerías, spas y otros sectores configurables.

## Estado

Fase inicial: prototipo visual del panel del negocio. Los datos son de muestra y viven solo en la sesión del navegador; todavía no hay login, backend ni persistencia.

## Abrir el prototipo

Abre `apps/web/index.html` en un navegador moderno. Puedes recorrer la navegación y agregar una cita de demostración; al recargar, los cambios desaparecen.

## Documentos

- `docs/arquitectura.md`: arquitectura, seguridad, costos y escalabilidad.
- `docs/plano-y-reglas-codex.md`: roadmap por capas e instrucciones para agentes de código.
- `apps/web/`: primer prototipo de interfaz, sin conexión a servicios externos.

## Principios

- Un producto central multi-tenant; cada registro de negocio se separa por `tenantId` y se autoriza en el backend.
- La agenda y las reglas críticas pertenecen al backend de Alaia.
- Integraciones (WhatsApp, pagos, IA, voz y automatización) se conectan mediante adaptadores reemplazables.
- No incluir secretos en Git. Configuración local va en `.env` ignorado por Git.
- No modificar ni copiar flujos de Novara sin auditoría y autorización específica.

# Capa 1 — Identidad y separación por negocio

## Alcance implementado

- API Node.js/Express con un endpoint de salud.
- Validación de Firebase ID token en el backend y rechazo de sesiones revocadas.
- Creación de un negocio para un usuario autenticado; quien lo crea recibe membresía `owner`.
- Listado de negocios activos de una cuenta.
- Resolución del tenant y verificación de membresía activa antes de mostrar el contexto de negocio.
- Reglas Firestore denegadas para el navegador. La API usa Admin SDK y aplica autorización explícita por membresía.
- Emuladores locales configurados para Auth y Firestore. No usa el proyecto productivo de Novara.

## Modelo mínimo

```text
tenants/{tenantId}
tenants/{tenantId}/memberships/{firebaseUid}
tenantSlugs/{slug}
```

La membresía contiene `userId`, `role`, `status`, `createdAt` e `invitedBy`. El primer miembro que crea el negocio recibe `role: owner`. Roles reconocidos: `owner`, `admin`, `professional`, `client`. Roles de plataforma se implementarán aparte y nunca se deducen de un campo enviado por el navegador.

## Rutas

- `GET /health` — proceso activo; no accede a datos.
- `POST /api/v1/tenants` — crea tenant + slug único + membresía de propietario en una transacción.
- `GET /api/v1/me/tenants` — lista solo negocios donde el UID autenticado tiene membresía activa.
- `GET /api/v1/tenants/:tenantId/context` — devuelve contexto solo después de comprobar token, tenant activo y membresía activa.

Todas las rutas `/api/v1` requieren `Authorization: Bearer <Firebase ID token>`. La API no acepta un rol del cliente. Los datos de negocio no se exponen mediante lecturas directas de Firestore.

## Ejecutar localmente

Desde la raíz del repositorio: copia `.env.example` a `.env`, ejecuta `npm install`, inicia `npm run emulators` y luego `npm run dev:api` en otra terminal. El proyecto emulado se llama `demo-alaia`; la configuración local no apunta a `novara-bot`.

Ya existe la pantalla de acceso/registro en `apps/web/` conectada al emulador, la creación del primer negocio, la selección del negocio activo (recordada en el navegador) y el panel protegido que consume estas rutas. Sigue pendiente: invitaciones, verificación de correo, recuperación de contraseña y consola de superadministrador. El detalle del corte está en `docs/corte-agenda-panel-real.md`.

## Límites conocidos antes de exponer en internet

- Crear negocios aún no tiene límites por usuario, invitaciones ni verificación de correo.
- No hay cuenta de superadministrador ni auditoría de acciones todavía.
- No se ha desplegado a Cloud Run ni conectado a un proyecto Firebase real.
- Las reglas deniegan todo acceso cliente directo; futuros endpoints deben mantener la autorización en servidor.
- No contiene clientes, conversaciones ni datos reales.

Firebase indica que Admin SDK omite Firestore Security Rules; por eso cada endpoint de la API vuelve a comprobar la membresía. Referencias: [verificar ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [reglas de Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions) y [emulador de Auth](https://firebase.google.com/docs/emulator-suite/connect_auth).

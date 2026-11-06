import { auth, db } from "./firebase.js";
import { sendError } from "./http.js";
import { isPlatformAdminEmail, resolveTenantPlan, resolveTenantStatus } from "./platform.js";
import { isTrialExpired } from "./trial.js";

export async function requireUser(req, res, next) {
  const authorization = req.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return sendError(res, 401, "unauthenticated", "Inicia sesión para continuar.");

  try {
    const token = await auth.verifyIdToken(match[1], true);
    req.user = { uid: token.uid, email: token.email ?? null };
    return next();
  } catch {
    return sendError(res, 401, "unauthenticated", "La sesión no es válida o ha vencido.");
  }
}

export async function requireTenantMembership(req, res, next) {
  const { tenantId } = req.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenantId)) {
    return sendError(res, 400, "invalid_tenant", "El negocio indicado no es válido.");
  }

  try {
    const tenantRef = db.collection("tenants").doc(tenantId);
    const membershipRef = tenantRef.collection("memberships").doc(req.user.uid);
    const [tenantSnapshot, membershipSnapshot] = await Promise.all([
      tenantRef.get(),
      membershipRef.get(),
    ]);

    if (!tenantSnapshot.exists || !membershipSnapshot.exists) {
      return sendError(res, 404, "tenant_not_found", "No se encontró el negocio o no tienes acceso.");
    }

    const membership = membershipSnapshot.data();
    const allowedRoles = new Set(["owner", "admin", "professional", "client"]);
    if (membership.userId !== req.user.uid || membership.status !== "active" || !allowedRoles.has(membership.role)) {
      return sendError(res, 404, "tenant_not_found", "No se encontró el negocio o no tienes acceso.");
    }

    const tenant = tenantSnapshot.data();
    const tenantStatus = resolveTenantStatus(tenant);
    const platformAdmin = isPlatformAdminEmail(req.user.email);
    // Un negocio suspendido no deja operar a sus miembros, salvo al admin de plataforma.
    if (tenantStatus === "suspended" && !platformAdmin) {
      return sendError(res, 403, "tenant_suspended", "Tu cuenta está suspendida. Contacta a ALAIA.");
    }
    if (tenantStatus !== "active" && !platformAdmin) {
      return sendError(res, 403, "tenant_unavailable", "El acceso a este negocio está pausado.");
    }
    // Prueba vencida sin plan: bloqueo total hasta que elija un plan.
    if (!platformAdmin && resolveTenantPlan(tenant) === "trial" && isTrialExpired(tenant)) {
      return sendError(res, 403, "tenant_trial_expired", "Tu periodo de prueba terminó. Elige un plan para seguir usando ALAIA.");
    }
    req.tenant = { id: tenantId, ...tenant, status: tenantStatus };
    req.membership = {
      userId: req.user.uid,
      role: membership.role,
      status: membership.status,
      professionalId: typeof membership.professionalId === "string" ? membership.professionalId : null,
    };
    return next();
  } catch {
    return sendError(res, 503, "tenant_lookup_failed", "No se pudo comprobar el acceso. Intenta de nuevo.");
  }
}

// Escrituras sensibles del negocio (horario, catálogo, equipo, invitaciones…):
// dueño o administrador del negocio. Debe usarse después de requireTenantMembership.
export function requireOwner(req, res, next) {
  if (req.membership?.role !== "owner" && req.membership?.role !== "admin") {
    return sendError(res, 403, "not_owner", "Solo el dueño o un administrador del negocio puede hacer este cambio.");
  }
  return next();
}

// Administrador de la plataforma ALAIA. Debe usarse después de requireUser.
export function requirePlatformAdmin(req, res, next) {
  if (!req.user) {
    return sendError(res, 401, "unauthenticated", "Inicia sesión para continuar.");
  }
  if (!isPlatformAdminEmail(req.user.email)) {
    return sendError(res, 403, "not_platform_admin", "No tienes acceso al panel de plataforma.");
  }
  return next();
}

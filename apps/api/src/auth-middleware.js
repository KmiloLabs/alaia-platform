import { auth, db } from "./firebase.js";
import { sendError } from "./http.js";

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
    if (tenant.status !== "active") {
      return sendError(res, 403, "tenant_unavailable", "El acceso a este negocio está pausado.");
    }
    req.tenant = { id: tenantId, ...tenant };
    req.membership = {
      userId: req.user.uid,
      role: membership.role,
      status: membership.status,
    };
    return next();
  } catch {
    return sendError(res, 503, "tenant_lookup_failed", "No se pudo comprobar el acceso. Intenta de nuevo.");
  }
}

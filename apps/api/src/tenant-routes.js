import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";

export const tenantRoutes = Router();
tenantRoutes.use(requireUser);

tenantRoutes.get("/me/tenants", asyncRoute(async (req, res) => {
  const memberships = await db.collectionGroup("memberships")
    .where("userId", "==", req.user.uid)
    .where("status", "==", "active")
    .get();

  const result = await Promise.all(memberships.docs.map(async (membershipDoc) => {
    const tenantRef = membershipDoc.ref.parent.parent;
    if (!tenantRef) return null;
    const tenantSnapshot = await tenantRef.get();
    if (!tenantSnapshot.exists) return null;
    const membership = membershipDoc.data();
    const tenant = tenantSnapshot.data();
    return {
      tenantId: tenantRef.id,
      name: tenant.name,
      slug: tenant.slug,
      sector: tenant.sector,
      role: membership.role,
    };
  }));

  return res.json({ tenants: result.filter(Boolean) });
}));

tenantRoutes.post("/tenants", asyncRoute(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const sector = typeof req.body?.sector === "string" ? req.body.sector : "";
  const timeZone = typeof req.body?.timeZone === "string" ? req.body.timeZone : "America/Bogota";
  const allowedSectors = new Set(["barberia", "peluqueria", "spa", "servicios"]);

  if (name.length < 2 || name.length > 120) {
    return sendError(res, 400, "invalid_name", "El nombre debe tener entre 2 y 120 caracteres.");
  }
  if (!allowedSectors.has(sector)) {
    return sendError(res, 400, "invalid_sector", "Selecciona un tipo de negocio válido.");
  }
  try {
    new Intl.DateTimeFormat("es-CO", { timeZone });
  } catch {
    return sendError(res, 400, "invalid_timezone", "La zona horaria no es válida.");
  }

  const slug = makeSlug(name);
  const tenantRef = db.collection("tenants").doc();
  const slugRef = db.collection("tenantSlugs").doc(slug);
  const membershipRef = tenantRef.collection("memberships").doc(req.user.uid);
  const tenantData = {
    name,
    slug,
    sector,
    timeZone,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: req.user.uid,
  };

  try {
    await db.runTransaction(async (transaction) => {
      const existingSlug = await transaction.get(slugRef);
      if (existingSlug.exists) {
        const error = new Error("slug-already-exists");
        error.code = "slug-already-exists";
        throw error;
      }
      transaction.create(tenantRef, tenantData);
      transaction.create(membershipRef, {
        userId: req.user.uid,
        role: "owner",
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        invitedBy: req.user.uid,
      });
      transaction.create(slugRef, {
        tenantId: tenantRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    if (error.code === "slug-already-exists") {
      return sendError(res, 409, "tenant_name_taken", "Ya existe un negocio con ese nombre. Prueba una variante.");
    }
    throw error;
  }

  return res.status(201).json({
    tenant: {
      tenantId: tenantRef.id,
      name,
      slug,
      sector,
      timeZone,
      status: "active",
      role: "owner",
    },
  });
}));

tenantRoutes.get("/tenants/:tenantId/context", requireTenantMembership, (req, res) => {
  return res.json({
    tenant: {
      tenantId: req.tenant.id,
      name: req.tenant.name,
      slug: req.tenant.slug,
      sector: req.tenant.sector,
      timeZone: req.tenant.timeZone,
      status: req.tenant.status,
    },
    membership: req.membership,
  });
});

function makeSlug(value) {
  const slug = value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return slug || "negocio";
}

// Invitaciones de trabajadores: rutas privadas (dueño/admin) y públicas por token.
// El token completo solo se devuelve al crear la invitación; en Firestore queda
// únicamente su sha256 y nunca se expone en listados.

import { Router } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { requireOwner, requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import { getProfessional } from "./professional-catalog.js";
import { professionalRepository } from "./professional-repository.js";
import {
  buildInvitationLink,
  buildPublicInvitation,
  computeInvitationStatus,
  generateInvitationToken,
  hashInvitationToken,
  resolveInvitationDays,
  serializeInvitation,
  validateInvitationInput,
} from "./invitation-catalog.js";
import { invitationRepository } from "./invitation-repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const invitationRoutes = Router();
invitationRoutes.use(requireUser);

invitationRoutes.get(
  "/tenants/:tenantId/invitations",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const docs = await invitationRepository.list(req.tenant.id);
    const invitations = docs
      .map((doc) => serializeInvitation(doc.invitationId, doc.data))
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
    return res.json({ invitations });
  }),
);

invitationRoutes.post(
  "/tenants/:tenantId/invitations",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const validation = validateInvitationInput(req.body);
    if (!validation.ok) return sendError(res, validation.status, validation.code, validation.message);

    const professional = await getProfessional({
      tenantId: req.tenant.id,
      professionalId: validation.value.professionalId,
      repository: professionalRepository,
    });
    if (!professional) {
      return sendError(res, 404, "professional_not_found", "No encontramos ese profesional en el negocio.");
    }

    const token = generateInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const days = resolveInvitationDays();
    const expiresAt = new Date(Date.now() + days * DAY_MS);
    const link = buildInvitationLink(token);

    const created = await invitationRepository.create(req.tenant.id, {
      professionalId: professional.professionalId,
      professionalName: professional.name,
      email: validation.value.email,
      phone: validation.value.phone,
      role: "professional",
      tokenHash,
      status: "pending",
      expiresAt: Timestamp.fromDate(expiresAt),
      createdBy: req.user.uid,
      acceptedBy: null,
      acceptedAt: null,
    });

    return res.status(201).json({
      invitation: {
        id: created.invitationId,
        professionalId: professional.professionalId,
        professionalName: professional.name,
        email: validation.value.email,
        phone: validation.value.phone,
        link,
        qrPayload: link,
        expiresAt: expiresAt.toISOString(),
      },
    });
  }),
);

invitationRoutes.delete(
  "/tenants/:tenantId/invitations/:invitationId",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const current = await invitationRepository.get(req.tenant.id, req.params.invitationId);
    if (!current) return sendError(res, 404, "invitation_not_found", "No encontramos esa invitación.");
    if (computeInvitationStatus(current.data) !== "pending") {
      return sendError(res, 409, "invitation_not_pending", "La invitación ya no está pendiente.");
    }

    const updated = await invitationRepository.update(req.tenant.id, req.params.invitationId, {
      status: "cancelled",
      cancelledBy: req.user.uid,
      cancelledAt: FieldValue.serverTimestamp(),
    });
    return res.json({ invitation: serializeInvitation(req.params.invitationId, updated.data) });
  }),
);

// --- Rutas públicas por token --------------------------------------------
export const publicInvitationRoutes = Router();

publicInvitationRoutes.get("/invitations/:token", asyncRoute(async (req, res) => {
  const tokenHash = hashInvitationToken(req.params.token);
  const found = await invitationRepository.findByTokenHash(tokenHash);
  if (!found) return sendError(res, 404, "invitation_not_found", "No encontramos esa invitación.");

  const tenantSnapshot = await found.tenantRef.get();
  const tenant = tenantSnapshot.exists ? tenantSnapshot.data() : {};
  return res.json(buildPublicInvitation({
    tenant,
    professionalName: found.data.professionalName,
    invitation: found.data,
  }));
}));

publicInvitationRoutes.post("/invitations/:token/accept", requireUser, asyncRoute(async (req, res) => {
  const tokenHash = hashInvitationToken(req.params.token);
  const found = await invitationRepository.findByTokenHash(tokenHash);
  if (!found) return sendError(res, 404, "invitation_not_found", "No encontramos esa invitación.");

  const outcome = await db.runTransaction(async (transaction) => {
    const invitationRef = found.ref;
    const invitationSnapshot = await transaction.get(invitationRef);
    if (!invitationSnapshot.exists) return { kind: "not_found" };

    const data = invitationSnapshot.data();
    const status = computeInvitationStatus(data);
    if (status === "expired") {
      if (data.status === "pending") transaction.update(invitationRef, { status: "expired" });
      return { kind: "expired" };
    }
    if (status !== "pending") return { kind: "not_pending" };

    const membershipRef = found.tenantRef.collection("memberships").doc(req.user.uid);
    const membershipSnapshot = await transaction.get(membershipRef);
    if (membershipSnapshot.exists) return { kind: "already_member" };

    transaction.create(membershipRef, {
      userId: req.user.uid,
      role: "professional",
      professionalId: typeof data.professionalId === "string" ? data.professionalId : null,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      invitedBy: typeof data.createdBy === "string" ? data.createdBy : null,
    });
    transaction.update(invitationRef, {
      status: "accepted",
      acceptedBy: req.user.uid,
      acceptedAt: FieldValue.serverTimestamp(),
    });
    return { kind: "accepted", professionalId: typeof data.professionalId === "string" ? data.professionalId : null };
  });

  if (outcome.kind === "not_found") {
    return sendError(res, 404, "invitation_not_found", "No encontramos esa invitación.");
  }
  if (outcome.kind === "expired") {
    return sendError(res, 410, "invitation_expired", "La invitación venció. Pide una nueva.");
  }
  if (outcome.kind === "not_pending") {
    return sendError(res, 409, "invitation_not_pending", "La invitación ya fue usada o cancelada.");
  }
  if (outcome.kind === "already_member") {
    return sendError(res, 409, "invitation_already_member", "Ya eres miembro de este negocio.");
  }

  return res.json({
    membership: {
      tenantId: found.tenantId,
      role: "professional",
      professionalId: outcome.professionalId,
    },
  });
}));

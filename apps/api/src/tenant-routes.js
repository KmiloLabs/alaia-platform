import { Router } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { requireOwner, requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import {
  DEFAULT_SLOT_STEP_MINUTES,
  MAX_STEP_MINUTES,
  MIN_STEP_MINUTES,
  normalizeOpeningHours,
  resolveDateOverrides,
  resolveOpeningHours,
  resolveSlotStepMinutes,
  validateDateOverrides,
  validateTenantScheduleUpdate,
} from "./availability.js";
import { createService } from "./service-catalog.js";
import { serviceRepository } from "./service-repository.js";
import { resolveReminders, validateReminders } from "./reminder-config.js";
import { resolveAssistant, validateAssistant } from "./assistant.js";
import { sectorTemplateFor } from "./sector-templates.js";
import { isPlatformAdminEmail } from "./platform.js";
import {
  resolveBusinessProfile,
  validateBusinessProfileInput,
} from "./business-profile.js";
import { resolveTrialDays, serializeTrial, trialEndsAtFromNow } from "./trial.js";

export const tenantRoutes = Router();
tenantRoutes.use(requireUser);

// Identidad del usuario autenticado: el panel usa isPlatformAdmin para mostrar
// (u ocultar) la entrada "Plataforma".
tenantRoutes.get("/me", (req, res) => {
  const isPlatformAdmin = isPlatformAdminEmail(req.user.email);
  return res.json({
    user: { uid: req.user.uid, email: req.user.email, isPlatformAdmin },
    isPlatformAdmin,
  });
});

tenantRoutes.get("/me/tenants", asyncRoute(async (req, res) => {
  // Índice propio por usuario (users/{uid}.tenantIds): evita consultas de grupo
  // de colecciones que exigen índices compuestos en Firestore real.
  const userSnapshot = await db.collection("users").doc(req.user.uid).get();
  const tenantIds = Array.isArray(userSnapshot.data()?.tenantIds) ? userSnapshot.data().tenantIds : [];

  const result = await Promise.all(tenantIds.map(async (tenantId) => {
    const tenantRef = db.collection("tenants").doc(tenantId);
    const membershipRef = tenantRef.collection("memberships").doc(req.user.uid);
    const [tenantSnapshot, membershipSnapshot] = await Promise.all([tenantRef.get(), membershipRef.get()]);
    if (!tenantSnapshot.exists || !membershipSnapshot.exists) return null;
    const membership = membershipSnapshot.data();
    if (membership.status !== "active") return null;
    const tenant = tenantSnapshot.data();
    return {
      tenantId: tenantRef.id,
      name: tenant.name,
      slug: tenant.slug,
      sector: tenant.sector,
      timeZone: tenant.timeZone,
      openingHours: resolveOpeningHours(tenant),
      dateOverrides: resolveDateOverrides(tenant),
      slotStepMinutes: resolveSlotStepMinutes(tenant),
      ...resolveBusinessProfile(tenant),
      ...serializeTrial(tenant),
      role: membership.role,
    };
  }));

  return res.json({ tenants: result.filter(Boolean) });
}));

tenantRoutes.post("/tenants", asyncRoute(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const sector = typeof req.body?.sector === "string" ? req.body.sector : "";
  const timeZone = typeof req.body?.timeZone === "string" ? req.body.timeZone : "America/Bogota";
  const allowedSectors = new Set(["barberia", "peluqueria", "spa", "unas", "pestanas", "cejas", "masajes", "estetica", "servicios"]);

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

  const openingHoursResult = normalizeOpeningHours(req.body?.openingHours);
  if (!openingHoursResult.ok) {
    return sendError(res, 400, openingHoursResult.code, openingHoursResult.message);
  }
  const rawSlotStepMinutes = req.body?.slotStepMinutes;
  const slotStepMinutes = rawSlotStepMinutes === undefined || rawSlotStepMinutes === null
    ? DEFAULT_SLOT_STEP_MINUTES
    : rawSlotStepMinutes;
  if (!Number.isInteger(slotStepMinutes) || slotStepMinutes < MIN_STEP_MINUTES || slotStepMinutes > MAX_STEP_MINUTES) {
    return sendError(res, 400, "invalid_step", "El paso de horarios debe ser un entero entre 5 y 240 minutos.");
  }

  const slug = makeSlug(name);
  const trialDays = resolveTrialDays();
  const trialEndsAt = trialEndsAtFromNow(trialDays);
  const tenantRef = db.collection("tenants").doc();
  const slugRef = db.collection("tenantSlugs").doc(slug);
  const membershipRef = tenantRef.collection("memberships").doc(req.user.uid);
  const tenantData = {
    name,
    slug,
    sector,
    timeZone,
    openingHours: openingHoursResult.value,
    slotStepMinutes,
    plan: "trial",
    trialEndsAt: Timestamp.fromDate(trialEndsAt),
    notes: "",
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
      transaction.set(
        db.collection("users").doc(req.user.uid),
        { tenantIds: FieldValue.arrayUnion(tenantRef.id), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    });
  } catch (error) {
    if (error.code === "slug-already-exists") {
      return sendError(res, 409, "tenant_name_taken", "Ya existe un negocio con ese nombre. Prueba una variante.");
    }
    throw error;
  }

  let seededServices = 0;
  for (const templateService of sectorTemplateFor(sector)) {
    try {
      const created = await createService({ tenantId: tenantRef.id, body: templateService, repository: serviceRepository });
      if (created.ok) seededServices += 1;
    } catch (error) {
      // La plantilla es una ayuda: si un servicio falla, el negocio puede crearlo a mano.
      console.warn("No se pudo precargar un servicio de la plantilla:", error?.message ?? error);
    }
  }

  return res.status(201).json({
    seededServices,
    tenant: {
      tenantId: tenantRef.id,
      name,
      slug,
      sector,
      timeZone,
      openingHours: openingHoursResult.value,
      slotStepMinutes,
      plan: "trial",
      trialEndsAt: trialEndsAt.toISOString(),
      trialDaysLeft: trialDays,
      notes: "",
      status: "active",
      role: "owner",
    },
  });
}));

// Horario y perfil del negocio: solo el dueño.
tenantRoutes.patch("/tenants/:tenantId", requireTenantMembership, requireOwner, asyncRoute(async (req, res) => {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};

  const profile = validateBusinessProfileInput(body);
  if (!profile.ok) return sendError(res, 400, profile.code, profile.message);

  const hasHoursFields = body.openingHours !== undefined || body.slotStepMinutes !== undefined;
  const hasScheduleFields = hasHoursFields || body.dateOverrides !== undefined;
  const hasReminders = body.reminders !== undefined;
  const hasAssistant = body.assistant !== undefined;
  if (!hasScheduleFields && !hasReminders && !hasAssistant && !profile.hasAny) {
    return sendError(res, 400, "empty_update", "Indica al menos un campo del negocio para actualizar.");
  }

  const schedule = hasHoursFields ? validateTenantScheduleUpdate(body) : { ok: true, value: {} };
  if (!schedule.ok) return sendError(res, 400, schedule.code, schedule.message);

  const overrides = body.dateOverrides !== undefined ? validateDateOverrides(body) : { ok: true, value: undefined };
  if (!overrides.ok) return sendError(res, 400, overrides.code, overrides.message);

  const reminders = hasReminders ? validateReminders(body) : { ok: true, value: undefined };
  if (!reminders.ok) return sendError(res, 400, reminders.code, reminders.message);

  const assistant = hasAssistant ? validateAssistant(body) : { ok: true, value: {} };
  if (!assistant.ok) return sendError(res, 400, assistant.code, assistant.message);

  const update = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: req.user.uid,
  };
  if (schedule.value.openingHours !== undefined) update.openingHours = schedule.value.openingHours;
  if (schedule.value.slotStepMinutes !== undefined) update.slotStepMinutes = schedule.value.slotStepMinutes;
  if (overrides.value !== undefined) update.dateOverrides = overrides.value;
  if (reminders.value !== undefined) update.reminders = reminders.value;
  if (assistant.value.privacyNotice !== undefined) {
    update.assistant = { ...resolveAssistant(req.tenant), privacyNotice: assistant.value.privacyNotice };
  }
  if (profile.value.description !== undefined) update.description = profile.value.description;
  if (profile.value.address !== undefined) update.address = profile.value.address;
  if (profile.value.phone !== undefined) update.phone = profile.value.phone;
  if (profile.value.socialLinks !== undefined) {
    update.socialLinks = {
      ...resolveBusinessProfile(req.tenant).socialLinks,
      ...profile.value.socialLinks,
    };
  }

  await db.collection("tenants").doc(req.tenant.id).set(update, { merge: true });

  const updatedTenant = {
    ...req.tenant,
    openingHours: schedule.value.openingHours ?? req.tenant.openingHours,
    slotStepMinutes: schedule.value.slotStepMinutes ?? req.tenant.slotStepMinutes,
    dateOverrides: overrides.value !== undefined ? overrides.value : resolveDateOverrides(req.tenant),
    reminders: reminders.value !== undefined ? reminders.value : resolveReminders(req.tenant),
    assistant: assistant.value.privacyNotice !== undefined
      ? { privacyNotice: assistant.value.privacyNotice }
      : resolveAssistant(req.tenant),
    description: profile.value.description ?? req.tenant.description,
    address: profile.value.address ?? req.tenant.address,
    phone: profile.value.phone ?? req.tenant.phone,
    socialLinks: profile.value.socialLinks ? update.socialLinks : req.tenant.socialLinks,
  };
  return res.json({
    tenant: {
      id: req.tenant.id,
      tenantId: req.tenant.id,
      name: req.tenant.name,
      slug: req.tenant.slug,
      sector: req.tenant.sector,
      timeZone: req.tenant.timeZone,
      openingHours: resolveOpeningHours(updatedTenant),
      dateOverrides: resolveDateOverrides(updatedTenant),
      reminders: resolveReminders(updatedTenant),
      assistant: resolveAssistant(updatedTenant),
      slotStepMinutes: resolveSlotStepMinutes(updatedTenant),
      ...resolveBusinessProfile(updatedTenant),
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
      openingHours: resolveOpeningHours(req.tenant),
      dateOverrides: resolveDateOverrides(req.tenant),
      reminders: resolveReminders(req.tenant),
      assistant: resolveAssistant(req.tenant),
      slotStepMinutes: resolveSlotStepMinutes(req.tenant),
      ...resolveBusinessProfile(req.tenant),
      status: req.tenant.status,
    },
    membership: req.membership,
    isPlatformAdmin: isPlatformAdminEmail(req.user.email),
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

// Página pública de reservas: sin autenticación, con límite de peticiones y sin
// exponer datos privados del negocio (correo del dueño, comisiones, teléfonos de
// profesionales, clientes ni citas).

import { Router } from "express";
import { db } from "./firebase.js";
import { asyncRoute, sendError } from "./http.js";
import { resolveTenantStatus } from "./platform.js";
import { resolveBusinessProfile } from "./business-profile.js";
import { resolveDateOverrides, resolveOpeningHours } from "./availability.js";
import {
  createAppointment,
  getAvailability,
  resolveTenantTimeZone,
} from "./appointment-service.js";
import { getActiveService, listServices } from "./service-catalog.js";
import { serviceRepository } from "./service-repository.js";
import { getProfessional, listProfessionals } from "./professional-catalog.js";
import { professionalRepository } from "./professional-repository.js";
import { createCustomer, findCustomerByPhone } from "./customer-catalog.js";
import { customerRepository } from "./customer-repository.js";
import {
  PUBLIC_DEFAULT_DURATION_MINUTES,
  isValidPublicSlug,
  resolvePublicAvailabilityDate,
  sanitizePublicProfessional,
  sanitizePublicService,
  sanitizePublicTenant,
  validatePublicBookingInput,
  validatePublicStart,
} from "./public-booking.js";
import { createRateLimitMiddleware, createRateLimiter } from "./rate-limiter.js";

const GENERAL_LIMIT = 60;
const GENERAL_WINDOW_MS = 60_000;
const BOOKING_LIMIT = 10;
const BOOKING_WINDOW_MS = 60 * 60 * 1000;
const TENANT_NOT_FOUND_MESSAGE = "No encontramos ese negocio.";

const generalLimiter = createRateLimiter({ limit: GENERAL_LIMIT, windowMs: GENERAL_WINDOW_MS });
const bookingLimiter = createRateLimiter({ limit: BOOKING_LIMIT, windowMs: BOOKING_WINDOW_MS });

const generalRateLimit = createRateLimitMiddleware({
  limiter: generalLimiter,
  keyFn: (req) => clientIp(req),
  message: "Demasiadas solicitudes. Intenta de nuevo en un minuto.",
});

const bookingRateLimit = createRateLimitMiddleware({
  limiter: bookingLimiter,
  keyFn: (req) => `${clientIp(req)}:${req.params.slug}`,
  message: "Demasiadas reservas desde esta conexión. Intenta más tarde.",
});

export const publicRoutes = Router();
// Solo las rutas públicas consumen el límite general (no todo /api/v1).
publicRoutes.use("/public", generalRateLimit);

publicRoutes.get("/public/tenants/:slug", asyncRoute(async (req, res) => {
  const tenant = await resolvePublicTenant(req.params.slug);
  if (!tenant) return tenantNotFound(res);

  const [servicesResult, professionalsResult] = await Promise.all([
    listServices({ tenantId: tenant.id, repository: serviceRepository }),
    listProfessionals({ tenantId: tenant.id, repository: professionalRepository }),
  ]);

  return res.json({
    tenant: sanitizePublicTenant({ ...tenant, ...resolveBusinessProfile(tenant) }),
    services: servicesResult.services.map(sanitizePublicService),
    professionals: professionalsResult.professionals.map(sanitizePublicProfessional),
  });
}));

publicRoutes.get("/public/tenants/:slug/availability", asyncRoute(async (req, res) => {
  const tenant = await resolvePublicTenant(req.params.slug);
  if (!tenant) return tenantNotFound(res);

  const timeZone = resolveTenantTimeZone(tenant);
  const dateResult = resolvePublicAvailabilityDate({ date: req.query?.date, timeZone });
  if (!dateResult.ok) return sendError(res, dateResult.status, dateResult.code, dateResult.message);
  const { date } = dateResult.value;

  let durationMinutes = PUBLIC_DEFAULT_DURATION_MINUTES;
  const serviceId = typeof req.query?.serviceId === "string" ? req.query.serviceId.trim() : "";
  if (serviceId !== "") {
    const service = await getActiveService({
      tenantId: tenant.id,
      serviceId,
      repository: serviceRepository,
    });
    if (!service) return sendError(res, 404, "service_not_found", "No encontramos ese servicio.");
    durationMinutes = service.durationMinutes;
  }

  let professionalId = null;
  const requestedProfessionalId = typeof req.query?.professionalId === "string"
    ? req.query.professionalId.trim()
    : "";
  if (requestedProfessionalId !== "") {
    const professional = await getProfessional({
      tenantId: tenant.id,
      professionalId: requestedProfessionalId,
      repository: professionalRepository,
    });
    if (!professional || professional.active === false) {
      return sendError(res, 404, "professional_not_found", "No encontramos ese profesional.");
    }
    professionalId = professional.professionalId;
  }

  const availability = await getAvailability({
    tenant,
    query: { from: date, to: date, durationMinutes },
    professionalId,
  });
  if (!availability.ok) {
    return sendError(res, availability.status, availability.code, availability.message);
  }

  return res.json({
    date,
    timeZone: availability.timeZone,
    durationMinutes: availability.durationMinutes,
    slots: availability.slots.map((slot) => ({ startsAtLocal: slot.startsAtLocal })),
  });
}));

publicRoutes.post("/public/tenants/:slug/appointments", bookingRateLimit, asyncRoute(async (req, res) => {
  const tenant = await resolvePublicTenant(req.params.slug);
  if (!tenant) return tenantNotFound(res);

  const validation = validatePublicBookingInput(req.body);
  if (!validation.ok) return sendError(res, validation.status, validation.code, validation.message);
  const input = validation.value;

  const service = await getActiveService({
    tenantId: tenant.id,
    serviceId: input.serviceId,
    repository: serviceRepository,
  });
  if (!service) return sendError(res, 404, "service_not_found", "No encontramos ese servicio.");

  let professional = null;
  if (input.professionalId !== null) {
    professional = await getProfessional({
      tenantId: tenant.id,
      professionalId: input.professionalId,
      repository: professionalRepository,
    });
    if (!professional || professional.active === false) {
      return sendError(res, 404, "professional_not_found", "No encontramos ese profesional.");
    }
  }

  const timeZone = resolveTenantTimeZone(tenant);
  const start = validatePublicStart({
    startsAtLocal: input.startsAtLocal,
    durationMinutes: service.durationMinutes,
    openingHours: resolveOpeningHours(tenant),
    dateOverrides: resolveDateOverrides(tenant),
    timeZone,
    now: new Date(),
  });
  if (!start.ok) return sendError(res, start.status, start.code, start.message);

  // Crea o reutiliza el cliente por teléfono (misma lógica del panel).
  let customer = await findCustomerByPhone({
    tenantId: tenant.id,
    phone: input.customerPhone,
    repository: customerRepository,
  });
  if (!customer) {
    const created = await createCustomer({
      tenantId: tenant.id,
      body: { name: input.customerName, phone: input.customerPhone },
      repository: customerRepository,
    });
    if (!created.ok) return sendError(res, created.status, created.code, created.message);
    customer = created.customer;
  }

  const result = await createAppointment({
    tenantId: tenant.id,
    tenant,
    timeZone,
    actorUid: null,
    source: "public",
    body: {
      customerId: customer.customerId,
      customerName: customer.name,
      customerPhone: customer.phone || input.customerPhone,
      professionalId: professional?.professionalId ?? null,
      serviceName: service.name,
      startsAt: start.value.startsAtLocal,
      durationMinutes: service.durationMinutes,
      priceCOP: service.priceCOP,
      notes: "",
      clientRequestId: input.clientRequestId,
    },
  });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);

  const appointment = result.appointment;
  return res.status(result.created ? 201 : 200).json({
    appointment: {
      appointmentId: appointment.appointmentId,
      startsAtLocal: appointment.startsAtLocal,
      serviceName: appointment.serviceName,
      professionalName: appointment.professionalName,
      status: appointment.status,
    },
  });
}));

async function resolvePublicTenant(slug) {
  if (!isValidPublicSlug(slug)) return null;

  const slugSnapshot = await db.collection("tenantSlugs").doc(slug).get();
  if (!slugSnapshot.exists) return null;
  const tenantId = slugSnapshot.data()?.tenantId;
  if (typeof tenantId !== "string" || tenantId === "") return null;

  const tenantSnapshot = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnapshot.exists) return null;

  const tenant = { id: tenantId, ...tenantSnapshot.data() };
  // Un negocio suspendido se comporta como inexistente: no se revela su estado.
  if (resolveTenantStatus(tenant) === "suspended") return null;
  return tenant;
}

function tenantNotFound(res) {
  return sendError(res, 404, "tenant_not_found", TENANT_NOT_FOUND_MESSAGE);
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

// Vista previa de liquidación de comisiones. Solo el dueño; las citas se acotan
// al rango de fechas en la zona horaria del negocio.

import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { requireOwner, requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import { isValidTimeZone, localDateRangeToUtc } from "./timezone.js";
import { buildSettlementPreview, validateSettlementRange } from "./settlement.js";
import { listProfessionals } from "./professional-catalog.js";
import { professionalRepository } from "./professional-repository.js";

const FALLBACK_TIME_ZONE = "America/Bogota";

export const settlementRoutes = Router();
settlementRoutes.use(requireUser);

settlementRoutes.get(
  "/tenants/:tenantId/settlements/preview",
  requireTenantMembership,
  requireOwner,
  asyncRoute(async (req, res) => {
    const validation = validateSettlementRange(req.query);
    if (!validation.ok) return sendError(res, validation.status, validation.code, validation.message);

    const { from, to } = validation.value;
    const timeZone = isValidTimeZone(req.tenant.timeZone) ? req.tenant.timeZone : FALLBACK_TIME_ZONE;
    const range = localDateRangeToUtc(from, to, timeZone);
    const tenantRef = db.collection("tenants").doc(req.tenant.id);

    const [appointmentsSnapshot, professionalsResult] = await Promise.all([
      tenantRef.collection("appointments")
        .where("startsAt", ">=", Timestamp.fromDate(range.start))
        .where("startsAt", "<", Timestamp.fromDate(range.end))
        .get(),
      listProfessionals({
        tenantId: req.tenant.id,
        includeInactive: true,
        repository: professionalRepository,
      }),
    ]);

    const preview = buildSettlementPreview({
      from,
      to,
      timeZone,
      appointments: appointmentsSnapshot.docs.map((doc) => doc.data()),
      professionals: professionalsResult.professionals,
    });
    return res.json(preview);
  }),
);

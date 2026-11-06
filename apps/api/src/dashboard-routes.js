// Resumen del negocio para el panel: citas, ingresos y clientes de hoy/semana/mes.
// Las consultas se acotan al mes de la fecha pedida (más la semana si cruza de
// mes); nunca se lee la colección entera de citas.

import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { requireTenantMembership, requireUser } from "./auth-middleware.js";
import { asyncRoute, sendError } from "./http.js";
import { buildDashboardSummary, getDashboardRanges, resolveDashboardDate } from "./dashboard.js";

export const dashboardRoutes = Router();
dashboardRoutes.use(requireUser);

dashboardRoutes.get("/tenants/:tenantId/dashboard", requireTenantMembership, asyncRoute(async (req, res) => {
  const result = resolveDashboardDate({
    date: typeof req.query?.date === "string" ? req.query.date : undefined,
    timeZone: req.tenant.timeZone,
  });
  if (!result.ok) return sendError(res, result.status, result.code, result.message);

  const { date, timeZone } = result.value;
  const ranges = getDashboardRanges(date, timeZone);
  const tenantRef = db.collection("tenants").doc(req.tenant.id);

  const [appointmentsSnapshot, customersTotal, customersThisMonth, customersLast30Days] = await Promise.all([
    tenantRef.collection("appointments")
      .where("startsAt", ">=", Timestamp.fromDate(ranges.query.start))
      .where("startsAt", "<", Timestamp.fromDate(ranges.query.end))
      .get(),
    countQuery(tenantRef.collection("customers")),
    countQuery(tenantRef.collection("customers")
      .where("createdAt", ">=", Timestamp.fromDate(ranges.month.start))
      .where("createdAt", "<", Timestamp.fromDate(ranges.month.end))),
    countQuery(tenantRef.collection("customers")
      .where("createdAt", ">=", Timestamp.fromDate(ranges.last30.start))
      .where("createdAt", "<", Timestamp.fromDate(ranges.last30.end))),
  ]);

  const appointments = appointmentsSnapshot.docs.map((doc) => doc.data());
  const summary = buildDashboardSummary({
    date,
    timeZone,
    appointments,
    customers: {
      total: customersTotal,
      newThisMonth: customersThisMonth,
      newLast30Days: customersLast30Days,
    },
  });

  return res.json(summary);
}));

// Cuenta sin descargar los documentos; si el emulador no soporta count, usa size.
async function countQuery(query) {
  try {
    const snapshot = await query.count().get();
    return snapshot.data().count;
  } catch {
    const snapshot = await query.get();
    return snapshot.size;
  }
}

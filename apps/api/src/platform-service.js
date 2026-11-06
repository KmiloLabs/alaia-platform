// Servicio del panel de plataforma: agregados de resumen, listado y detalle de
// negocios con sus métricas. Solo lectura de métricas y cambios de estado/plan;
// el administrador no entra a la agenda de los negocios.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { auth, db } from "./firebase.js";
import {
  buildPlatformSummary,
  filterPlatformTenants,
  resolveTenantNotes,
  resolveTenantPlan,
  resolveTenantStatus,
  resolveTenantUsage,
  statusFilterIsValid,
  sumUsageLast30Days,
  validateTenantAdminUpdate,
} from "./platform.js";

const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_RECENT_ACTIVITY = 10;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const AUTH_LOOKUP_CHUNK = 100;

export async function getPlatformSummary({ now = new Date() } = {}) {
  const snapshot = await db.collection("tenants").get();
  const tenantRows = snapshot.docs.map((doc) => ({ tenantId: doc.id, ...doc.data() }));
  const cutoff7 = Timestamp.fromMillis(now.getTime() - SEVEN_DAYS_MS);

  let appointmentsLast7Days = 0;
  let customersTotal = 0;
  let agentMessagesLast30Days = 0;

  for (const tenant of tenantRows) {
    const tenantRef = db.collection("tenants").doc(tenant.tenantId);
    const [appointmentsSnapshot, customersSnapshot] = await Promise.all([
      tenantRef.collection("appointments").where("createdAt", ">=", cutoff7).get(),
      tenantRef.collection("customers").get(),
    ]);
    appointmentsLast7Days += appointmentsSnapshot.size;
    customersTotal += customersSnapshot.size;
    agentMessagesLast30Days += sumUsageLast30Days(tenant, now);
  }

  return buildPlatformSummary({
    tenantRows,
    appointmentsLast7Days,
    customersTotal,
    agentMessagesLast30Days,
  });
}

export async function listPlatformTenants({ query = "", status = "" } = {}) {
  if (!statusFilterIsValid(status)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_status",
      message: "El estado debe ser \"active\" o \"suspended\".",
    };
  }

  const snapshot = await db.collection("tenants").get();
  const emailCache = new Map();
  const rows = [];

  for (const doc of snapshot.docs) {
    const tenant = { tenantId: doc.id, ...doc.data() };
    const tenantRef = doc.ref;
    const [membershipsSnapshot, appointmentsSnapshot, customersSnapshot] = await Promise.all([
      tenantRef.collection("memberships").get(),
      tenantRef.collection("appointments").get(),
      tenantRef.collection("customers").get(),
    ]);

    const members = membershipsSnapshot.docs.map((membership) => ({
      userId: membership.data().userId ?? membership.id,
      role: membership.data().role ?? null,
      status: membership.data().status ?? null,
    }));
    const emails = await resolveEmails(members.map((member) => member.userId), emailCache);
    const owner = members.find((member) => member.role === "owner");

    rows.push({
      ...serializeTenantBase(tenant),
      ownerEmail: owner ? emails.get(owner.userId) ?? null : null,
      usage: resolveTenantUsage(tenant),
      counts: {
        appointments: appointmentsSnapshot.size,
        customers: customersSnapshot.size,
        members: membershipsSnapshot.size,
      },
    });
  }

  return { ok: true, tenants: filterPlatformTenants(rows, { query, status }) };
}

export async function getPlatformTenantDetail({ tenantId }) {
  if (!TENANT_ID_PATTERN.test(tenantId)) return tenantNotFound();
  const snapshot = await db.collection("tenants").doc(tenantId).get();
  if (!snapshot.exists) return tenantNotFound();

  const tenant = { tenantId, ...snapshot.data() };
  const tenantRef = snapshot.ref;
  const [membershipsSnapshot, recentAppointmentsSnapshot] = await Promise.all([
    tenantRef.collection("memberships").get(),
    tenantRef.collection("appointments").orderBy("createdAt", "desc").limit(MAX_RECENT_ACTIVITY).get(),
  ]);

  const emailCache = new Map();
  const members = await Promise.all(membershipsSnapshot.docs.map(async (membership) => {
    const data = membership.data();
    const userId = data.userId ?? membership.id;
    const emails = await resolveEmails([userId], emailCache);
    return {
      userId,
      email: emails.get(userId) ?? null,
      role: data.role ?? null,
      status: data.status ?? null,
    };
  }));

  const recentActivity = recentAppointmentsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      type: "appointment",
      appointmentId: doc.id,
      customerName: data.customerName ?? null,
      serviceName: data.serviceName ?? null,
      startsAtLocal: data.startsAtLocal ?? null,
      status: data.status ?? "scheduled",
      createdAt: toIsoString(data.createdAt),
    };
  });

  return {
    ok: true,
    tenant: {
      ...serializeTenantBase(tenant),
      members,
      recentActivity,
    },
  };
}

export async function updatePlatformTenant({ tenantId, body, actorUid = null }) {
  if (!TENANT_ID_PATTERN.test(tenantId)) return tenantNotFound();
  const ref = db.collection("tenants").doc(tenantId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return tenantNotFound();

  const validation = validateTenantAdminUpdate(body);
  if (!validation.ok) return validation;

  const update = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorUid,
  };
  if (validation.value.status !== undefined) update.status = validation.value.status;
  if (validation.value.plan !== undefined) update.plan = validation.value.plan;
  if (validation.value.notes !== undefined) update.notes = validation.value.notes;

  await ref.set(update, { merge: true });

  return {
    ok: true,
    tenant: serializeTenantBase({ tenantId, ...snapshot.data(), ...update }),
  };
}

function serializeTenantBase(tenant) {
  return {
    tenantId: tenant.tenantId,
    id: tenant.tenantId,
    name: typeof tenant.name === "string" ? tenant.name : "",
    slug: typeof tenant.slug === "string" ? tenant.slug : "",
    sector: typeof tenant.sector === "string" ? tenant.sector : "",
    timeZone: typeof tenant.timeZone === "string" ? tenant.timeZone : "America/Bogota",
    createdAt: toIsoString(tenant.createdAt),
    status: resolveTenantStatus(tenant),
    plan: resolveTenantPlan(tenant),
    notes: resolveTenantNotes(tenant),
  };
}

async function resolveEmails(userIds, cache) {
  const unique = [...new Set(userIds.filter((uid) => typeof uid === "string" && uid !== ""))];
  const missing = unique.filter((uid) => !cache.has(uid));

  for (let index = 0; index < missing.length; index += AUTH_LOOKUP_CHUNK) {
    const chunk = missing.slice(index, index + AUTH_LOOKUP_CHUNK);
    try {
      const result = await auth.getUsers(chunk.map((uid) => ({ uid })));
      for (const user of result.users) cache.set(user.uid, user.email ?? null);
      for (const notFound of result.notFound ?? []) cache.set(notFound.uid, null);
    } catch {
      // Si Auth falla, el panel sigue funcionando sin correo resuelto.
      for (const uid of chunk) cache.set(uid, null);
    }
  }

  const emails = new Map();
  for (const uid of unique) emails.set(uid, cache.get(uid) ?? null);
  return emails;
}

function toIsoString(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function tenantNotFound() {
  return {
    ok: false,
    status: 404,
    code: "tenant_not_found",
    message: "No encontramos ese negocio.",
  };
}

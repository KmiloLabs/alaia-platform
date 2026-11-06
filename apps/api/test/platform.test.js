import test from "node:test";
import assert from "node:assert/strict";
import {
  TENANT_PLANS,
  TENANT_STATUSES,
  buildPlatformSummary,
  filterPlatformTenants,
  isPlatformAdminEmail,
  normalizePlatformText,
  parsePlatformAdminEmails,
  resolveTenantNotes,
  resolveTenantPlan,
  resolveTenantStatus,
  resolveTenantUsage,
  statusFilterIsValid,
  sumUsageLast30Days,
  validateTenantAdminUpdate,
} from "../src/platform.js";

test("normaliza la lista de correos de administradores", () => {
  assert.deepEqual(parsePlatformAdminEmails(" Admin@Alaia.test , otro@alaia.test,,"), ["admin@alaia.test", "otro@alaia.test"]);
  assert.deepEqual(parsePlatformAdminEmails("admin@alaia.test,ADMIN@ALAIA.TEST"), ["admin@alaia.test"]);
  assert.deepEqual(parsePlatformAdminEmails(""), []);
  assert.deepEqual(parsePlatformAdminEmails(undefined), []);
  assert.deepEqual(parsePlatformAdminEmails(null), []);
});

test("isPlatformAdminEmail compara sin mayúsculas y sin variable nadie es admin", () => {
  const env = { PLATFORM_ADMIN_EMAILS: "admin@alaia.test, Otro@Alaia.Test" };
  assert.equal(isPlatformAdminEmail("admin@alaia.test", env), true);
  assert.equal(isPlatformAdminEmail("ADMIN@ALAIA.TEST", env), true);
  assert.equal(isPlatformAdminEmail("otro@alaia.test", env), true);
  assert.equal(isPlatformAdminEmail("duena@alaia.test", env), false);
  assert.equal(isPlatformAdminEmail("", env), false);
  assert.equal(isPlatformAdminEmail(null, env), false);
  assert.equal(isPlatformAdminEmail("admin@alaia.test", {}), false);
});

test("valores por defecto de estado, plan y notas en tenants antiguos", () => {
  assert.equal(resolveTenantStatus({}), "active");
  assert.equal(resolveTenantStatus({ status: "suspended" }), "suspended");
  assert.equal(resolveTenantStatus({ status: "active" }), "active");
  assert.equal(resolveTenantPlan({}), "trial");
  assert.equal(resolveTenantPlan({ plan: "pro" }), "pro");
  assert.equal(resolveTenantPlan({ plan: "inventado" }), "trial");
  assert.equal(resolveTenantNotes({}), "");
  assert.equal(resolveTenantNotes({ notes: "Solo lectura" }), "Solo lectura");
  assert.deepEqual(resolveTenantUsage({}), { agentMessages: 0, inputTokens: 0, outputTokens: 0, updatedAt: null });
  assert.deepEqual(resolveTenantUsage({ usage: { agentMessages: 3, inputTokens: 10, outputTokens: 5 } }), {
    agentMessages: 3,
    inputTokens: 10,
    outputTokens: 5,
    updatedAt: null,
  });
});

test("valida el PATCH de estado, plan y notas", () => {
  const valid = validateTenantAdminUpdate({ status: "suspended", plan: "pro", notes: "Pago pendiente" });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, { status: "suspended", plan: "pro", notes: "Pago pendiente" });

  assert.deepEqual(validateTenantAdminUpdate({}), { ok: true, value: {} });
  assert.deepEqual(validateTenantAdminUpdate({ plan: "basico" }).value, { plan: "basico" });

  const cases = [
    ["invalid_status", { status: "pausado" }],
    ["invalid_status", { status: 42 }],
    ["invalid_plan", { plan: "oro" }],
    ["invalid_plan", { plan: null }],
    ["invalid_notes", { notes: "x".repeat(301) }],
    ["invalid_notes", { notes: 42 }],
  ];
  for (const [code, body] of cases) {
    const result = validateTenantAdminUpdate(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, code, JSON.stringify(body));
  }
});

test("el resumen se calcula con dobles", () => {
  const summary = buildPlatformSummary({
    tenantRows: [
      { status: "active", plan: "trial" },
      { status: "active", plan: "pro" },
      { status: "suspended", plan: "basico" },
      { plan: "trial" },
    ],
    appointmentsLast7Days: 8,
    customersTotal: 12,
    agentMessagesLast30Days: 40,
  });
  assert.deepEqual(summary, {
    tenants: { total: 4, active: 3, suspended: 1, trial: 2 },
    appointmentsLast7Days: 8,
    customersTotal: 12,
    agentMessagesLast30Days: 40,
  });
  assert.deepEqual(buildPlatformSummary(), {
    tenants: { total: 0, active: 0, suspended: 0, trial: 0 },
    appointmentsLast7Days: 0,
    customersTotal: 0,
    agentMessagesLast30Days: 0,
  });
});

test("suma los mensajes de los últimos 30 días desde usageDaily", () => {
  const now = new Date("2026-11-06T15:00:00.000Z"); // 2026-11-06 en Bogotá
  const tenant = {
    timeZone: "America/Bogota",
    usageDaily: {
      "2026-11-06": { agentMessages: 2 },
      "2026-11-05": { agentMessages: 3 },
      "2026-10-01": { agentMessages: 9 },
      "2026-09-01": { agentMessages: 100 },
    },
  };
  assert.equal(sumUsageLast30Days(tenant, now), 5);
  assert.equal(sumUsageLast30Days({ timeZone: "America/Bogota", usage: { agentMessages: 7 } }, now), 7);
  assert.equal(sumUsageLast30Days({}, now), 0);
});

test("filtra la lista de negocios por estado y búsqueda", () => {
  const rows = [
    { name: "Barbería Araan", slug: "barberia-araan", ownerEmail: "duena@alaia.test", status: "active" },
    { name: "Spa Óscar", slug: "spa-oscar", ownerEmail: "oscar@alaia.test", status: "suspended" },
  ];
  assert.deepEqual(filterPlatformTenants(rows, { status: "suspended" }).map((row) => row.name), ["Spa Óscar"]);
  assert.deepEqual(filterPlatformTenants(rows, { query: "araan" }).map((row) => row.name), ["Barbería Araan"]);
  assert.deepEqual(filterPlatformTenants(rows, { query: "oscar" }).map((row) => row.name), ["Spa Óscar"]);
  assert.deepEqual(filterPlatformTenants(rows, { query: "DUENA@ALAIA" }).map((row) => row.name), ["Barbería Araan"]);
  assert.equal(filterPlatformTenants(rows, {}).length, 2);
});

test("constantes y validación del filtro de estado", () => {
  assert.deepEqual([...TENANT_STATUSES], ["active", "suspended"]);
  assert.deepEqual([...TENANT_PLANS], ["trial", "basico", "pro"]);
  assert.equal(statusFilterIsValid(""), true);
  assert.equal(statusFilterIsValid(undefined), true);
  assert.equal(statusFilterIsValid("active"), true);
  assert.equal(statusFilterIsValid("suspended"), true);
  assert.equal(statusFilterIsValid("pausado"), false);
  assert.equal(normalizePlatformText("  Óscar  PÉREZ "), "oscar perez");
});

test("validateTenantAdminUpdate acepta trialDays y rechaza valores inválidos", () => {
  const ok = validateTenantAdminUpdate({ trialDays: 7 });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.trialDays, 7);
  for (const value of [-1, 366, 1.5, "7"]) {
    const result = validateTenantAdminUpdate({ trialDays: value });
    assert.equal(result.ok, false, `debería fallar con ${value}`);
    assert.equal(result.code, "invalid_trial_days");
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TRIAL_DAYS,
  computeTrialDaysLeft,
  resolveTrialDays,
  serializeTrial,
  trialEndsAtFromNow,
} from "../src/trial.js";

test("TRIAL_DAYS por defecto 14 y valores válidos", () => {
  assert.equal(resolveTrialDays({}), DEFAULT_TRIAL_DAYS);
  assert.equal(resolveTrialDays({ TRIAL_DAYS: "7" }), 7);
  assert.equal(resolveTrialDays({ TRIAL_DAYS: "30" }), 30);
  for (const value of ["0", "-5", "abc", "999", ""]) {
    assert.equal(resolveTrialDays({ TRIAL_DAYS: value }), DEFAULT_TRIAL_DAYS, value);
  }
});

test("trialEndsAtFromNow suma los días pedidos", () => {
  const now = new Date("2026-11-06T15:00:00.000Z");
  assert.equal(trialEndsAtFromNow(14, now).toISOString(), "2026-11-20T15:00:00.000Z");
  assert.equal(trialEndsAtFromNow(1, now).toISOString(), "2026-11-07T15:00:00.000Z");
});

test("trialDaysLeft en días naturales con la zona del negocio", () => {
  const now = new Date("2026-11-06T15:00:00.000Z");
  assert.equal(computeTrialDaysLeft(new Date("2026-11-20T15:00:00.000Z"), now, "America/Bogota"), 14);
  assert.equal(computeTrialDaysLeft(new Date("2026-11-07T15:00:00.000Z"), now, "America/Bogota"), 1);
  // Vencida: nunca negativo.
  assert.equal(computeTrialDaysLeft(new Date("2026-11-01T15:00:00.000Z"), now, "America/Bogota"), 0);
  // Sin fecha de prueba.
  assert.equal(computeTrialDaysLeft(null, now, "America/Bogota"), null);
  assert.equal(computeTrialDaysLeft(undefined, now, "America/Bogota"), null);
});

test("la zona horaria puede cambiar los días restantes (cambio de horario)", () => {
  const now = new Date("2026-03-01T04:30:00.000Z");
  const endsAt = new Date("2026-03-20T04:30:00.000Z");
  // Nueva York pasa a horario de verano el 8 de marzo de 2026: el fin de prueba
  // cae ya en la madrugada del 20 (local), mientras que en Bogotá sigue el 19.
  assert.equal(computeTrialDaysLeft(endsAt, now, "America/New_York"), 20);
  assert.equal(computeTrialDaysLeft(endsAt, now, "America/Bogota"), 19);
});

test("serializeTrial devuelve plan, fecha ISO y días (null sin fecha)", () => {
  const now = new Date("2026-11-06T15:00:00.000Z");
  const withTrial = serializeTrial({
    plan: "trial",
    timeZone: "America/Bogota",
    trialEndsAt: new Date("2026-11-20T15:00:00.000Z"),
  }, now);
  assert.deepEqual(withTrial, {
    plan: "trial",
    trialEndsAt: "2026-11-20T15:00:00.000Z",
    trialDaysLeft: 14,
  });

  const legacy = serializeTrial({ timeZone: "America/Bogota" }, now);
  assert.deepEqual(legacy, { plan: "trial", trialEndsAt: null, trialDaysLeft: null });

  const unknownPlan = serializeTrial({ plan: "pro" }, now);
  assert.equal(unknownPlan.plan, "pro");
});

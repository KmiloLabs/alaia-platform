import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OPENING_HOURS,
  generateAvailabilitySlots,
  isWithinEffectiveWindows,
  resolveDateOverrides,
  resolveEffectiveWindows,
  validateAppointmentWindow,
  validateDateOverrides,
} from "../src/availability.js";
import { validatePublicStart } from "../src/public-booking.js";
import { buildAgentSystemPrompt } from "../src/agent/prompts.js";

const BOGOTA = "America/Bogota";
const TENANT = {
  name: "Araan Barbería",
  timeZone: BOGOTA,
  openingHours: DEFAULT_OPENING_HOURS,
  dateOverrides: [
    { date: "2026-11-15", closed: false, open: "10:00", close: "14:00" },
    { date: "2026-11-17", closed: true },
  ],
};

test("valida la lista de fechas especiales", () => {
  const valid = validateDateOverrides({
    dateOverrides: [
      { date: "2026-11-15", closed: false, open: "10:00", close: "14:00" },
      { date: "2026-11-17", closed: true },
    ],
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, [
    { date: "2026-11-15", closed: false, open: "10:00", close: "14:00" },
    { date: "2026-11-17", closed: true },
  ]);
});

test("códigos de error de fechas especiales", () => {
  const cases = [
    ["invalid_date_overrides", { dateOverrides: "no-es-lista" }],
    ["invalid_date_overrides", { dateOverrides: Array.from({ length: 121 }, (_, index) => ({ date: `2026-11-${String((index % 30) + 1).padStart(2, "0")}`, closed: true })) }],
    ["invalid_date_overrides", { dateOverrides: [null] }],
    ["invalid_override_date", { dateOverrides: [{ date: "2026-02-30", closed: true }] }],
    ["duplicate_override_date", { dateOverrides: [{ date: "2026-11-17", closed: true }, { date: "2026-11-17", closed: true }] }],
    ["invalid_override_hours", { dateOverrides: [{ date: "2026-11-15", open: "10:00", close: "10:00" }] }],
    ["invalid_override_hours", { dateOverrides: [{ date: "2026-11-15", open: "14:00", close: "10:00" }] }],
    ["invalid_override_hours", { dateOverrides: [{ date: "2026-11-15" }] }],
    ["invalid_override_hours", { dateOverrides: [{ date: "2026-11-15", open: "25:00", close: "14:00" }] }],
    ["invalid_date_overrides", { dateOverrides: [{ date: "2026-11-15", closed: "si" }] }],
  ];
  for (const [code, body] of cases) {
    const result = validateDateOverrides(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, code, JSON.stringify(body));
  }

  // closed:true ignora open/close inválidos.
  const closed = validateDateOverrides({ dateOverrides: [{ date: "2026-11-17", closed: true, open: "xx" }] });
  assert.equal(closed.ok, true);
  assert.deepEqual(closed.value, [{ date: "2026-11-17", closed: true }]);
});

test("el negocio sin campo se comporta como el horario semanal", () => {
  const tenant = { openingHours: DEFAULT_OPENING_HOURS };
  assert.deepEqual(resolveDateOverrides(tenant), []);
  assert.deepEqual(resolveEffectiveWindows(tenant, "2026-11-16"), [{ open: "09:00", close: "18:00" }]);
  assert.deepEqual(resolveEffectiveWindows(tenant, "2026-11-15"), []);
});

test("resolveDateOverrides ignora valores inválidos al leer", () => {
  const tenant = {
    dateOverrides: [
      { date: "2026-11-17", closed: true },
      { date: "mal" },
      { date: "2026-11-15", open: "14:00", close: "10:00" },
      { date: "2026-11-16", open: "10:00", close: "13:00" },
      { date: "2026-11-17", closed: false, open: "09:00", close: "10:00" },
      { date: "2026-11-18", closed: "si" },
    ],
  };
  assert.deepEqual(resolveDateOverrides(tenant), [
    { date: "2026-11-16", closed: false, open: "10:00", close: "13:00" },
    { date: "2026-11-17", closed: true },
  ]);
});

test("la excepción manda sobre el horario semanal", () => {
  // Domingo 15 de noviembre de 2026: abierto solo por excepción.
  assert.deepEqual(resolveEffectiveWindows(TENANT, "2026-11-15"), [{ open: "10:00", close: "14:00" }]);
  // Otros domingos siguen cerrados.
  assert.deepEqual(resolveEffectiveWindows(TENANT, "2026-11-22"), []);
  // Martes laborable cerrado por excepción.
  assert.deepEqual(resolveEffectiveWindows(TENANT, "2026-11-17"), []);
  // Lunes laborable normal.
  assert.deepEqual(resolveEffectiveWindows(TENANT, "2026-11-16"), [{ open: "09:00", close: "18:00" }]);
});

test("slots con excepción abierta solo ese domingo y cerrados los demás", () => {
  const slots = generateAvailabilitySlots({
    from: "2026-11-15",
    to: "2026-11-15",
    timeZone: BOGOTA,
    openingHours: DEFAULT_OPENING_HOURS,
    dateOverrides: TENANT.dateOverrides,
    durationMinutes: 30,
    stepMinutes: 30,
    now: new Date("2026-11-01T00:00:00.000Z"),
  });
  assert.equal(slots.length, 8);
  assert.equal(slots[0].startsAtLocal, "2026-11-15T10:00");
  assert.equal(slots.at(-1).startsAtLocal, "2026-11-15T13:30");

  const otherSunday = generateAvailabilitySlots({
    from: "2026-11-22",
    to: "2026-11-22",
    timeZone: BOGOTA,
    openingHours: DEFAULT_OPENING_HOURS,
    dateOverrides: TENANT.dateOverrides,
    durationMinutes: 30,
    stepMinutes: 30,
    now: new Date("2026-11-01T00:00:00.000Z"),
  });
  assert.deepEqual(otherSunday, []);

  const closedTuesday = generateAvailabilitySlots({
    from: "2026-11-17",
    to: "2026-11-17",
    timeZone: BOGOTA,
    openingHours: DEFAULT_OPENING_HOURS,
    dateOverrides: TENANT.dateOverrides,
    durationMinutes: 30,
    stepMinutes: 30,
    now: new Date("2026-11-01T00:00:00.000Z"),
  });
  assert.deepEqual(closedTuesday, []);

  // Sin dateOverrides el domingo normal sigue cerrado.
  const withoutOverride = generateAvailabilitySlots({
    from: "2026-11-15",
    to: "2026-11-15",
    timeZone: BOGOTA,
    openingHours: DEFAULT_OPENING_HOURS,
    durationMinutes: 30,
    stepMinutes: 30,
    now: new Date("2026-11-01T00:00:00.000Z"),
  });
  assert.deepEqual(withoutOverride, []);
});

test("la reserva valida el horario efectivo de la fecha", () => {
  const inside = validateAppointmentWindow({
    tenant: TENANT,
    startsAtLocal: "2026-11-15T10:00",
    durationMinutes: 45,
  });
  assert.equal(inside.ok, true);

  const endsExactly = validateAppointmentWindow({
    tenant: TENANT,
    startsAtLocal: "2026-11-15T13:00",
    durationMinutes: 60,
  });
  assert.equal(endsExactly.ok, true);

  const outside = validateAppointmentWindow({
    tenant: TENANT,
    startsAtLocal: "2026-11-15T13:30",
    durationMinutes: 60,
  });
  assert.equal(outside.ok, false);
  assert.equal(outside.status, 400);
  assert.equal(outside.code, "outside_business_hours");

  const tooLate = validateAppointmentWindow({
    tenant: TENANT,
    startsAtLocal: "2026-11-15T16:00",
    durationMinutes: 30,
  });
  assert.equal(tooLate.ok, false);

  const closedDay = validateAppointmentWindow({
    tenant: TENANT,
    startsAtLocal: "2026-11-17T10:00",
    durationMinutes: 30,
  });
  assert.equal(closedDay.ok, false);

  const normalSunday = validateAppointmentWindow({
    tenant: TENANT,
    startsAtLocal: "2026-11-22T10:00",
    durationMinutes: 30,
  });
  assert.equal(normalSunday.ok, false);

  assert.equal(isWithinEffectiveWindows({
    windows: [{ open: "10:00", close: "14:00" }],
    startsAtLocal: "2026-11-15T10:00",
    durationMinutes: 30,
  }), true);
});

test("la reserva pública respeta la excepción", () => {
  const inside = validatePublicStart({
    startsAtLocal: "2026-11-15T10:00",
    durationMinutes: 45,
    openingHours: DEFAULT_OPENING_HOURS,
    dateOverrides: TENANT.dateOverrides,
    timeZone: BOGOTA,
    now: new Date("2026-11-01T00:00:00.000Z"),
  });
  assert.equal(inside.ok, true);

  for (const startsAtLocal of ["2026-11-15T16:00", "2026-11-17T10:00", "2026-11-22T10:00"]) {
    const outside = validatePublicStart({
      startsAtLocal,
      durationMinutes: 30,
      openingHours: DEFAULT_OPENING_HOURS,
      dateOverrides: TENANT.dateOverrides,
      timeZone: BOGOTA,
      now: new Date("2026-11-01T00:00:00.000Z"),
    });
    assert.equal(outside.ok, false, startsAtLocal);
    assert.equal(outside.code, "outside_business_hours");
  }
});

test("el prompt del agente incluye hasta 5 excepciones próximas y la regla", () => {
  const prompt = buildAgentSystemPrompt({
    tenant: {
      ...TENANT,
      dateOverrides: [
        { date: "2026-11-15", closed: false, open: "10:00", close: "14:00" },
        { date: "2026-11-17", closed: true },
        { date: "2026-11-20", closed: true },
        { date: "2026-11-21", closed: true },
        { date: "2026-11-22", closed: true },
        { date: "2026-11-23", closed: true },
        { date: "2026-11-18", closed: true },
        { date: "2026-10-01", closed: true },
      ],
    },
    config: {},
    now: new Date("2026-11-06T15:00:00.000Z"),
  });
  assert.match(prompt, /Fechas especiales próximas/);
  assert.match(prompt, /2026-11-15 abierto 10:00-14:00/);
  assert.match(prompt, /2026-11-17 cerrado/);
  assert.match(prompt, /mandan sobre el horario semanal/);
  // Solo 5 próximas: las 6ª y 7ª no aparecen, la pasada tampoco.
  assert.doesNotMatch(prompt, /2026-11-23 cerrado/);
  assert.doesNotMatch(prompt, /2026-11-22 cerrado/);
  assert.doesNotMatch(prompt, /2026-10-01/);
});

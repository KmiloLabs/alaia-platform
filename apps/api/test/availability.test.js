import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OPENING_HOURS,
  MAX_AVAILABILITY_SLOTS,
  businessDayNumber,
  generateAvailabilitySlots,
  normalizeOpeningHours,
  resolveOpeningHours,
  resolveSlotStepMinutes,
  validateAvailabilityQuery,
} from "../src/availability.js";
import { localToUtc } from "../src/timezone.js";

const TIME_ZONE = "America/Bogota";
const WEDNESDAY = "2031-01-15";
const THURSDAY = "2031-01-16";
const SUNDAY = "2031-01-19";

function slotsOf(overrides = {}) {
  return generateAvailabilitySlots({
    from: WEDNESDAY,
    to: WEDNESDAY,
    timeZone: TIME_ZONE,
    openingHours: DEFAULT_OPENING_HOURS,
    durationMinutes: 45,
    stepMinutes: 30,
    now: new Date(0),
    busy: [],
    ...overrides,
  });
}

function busyRange(fromLocal, toLocal, timeZone = TIME_ZONE) {
  return { start: localToUtc(fromLocal, timeZone), end: localToUtc(toLocal, timeZone) };
}

test("horario normal: 09:00–18:00 cada 30 min con duración 45", () => {
  const slots = slotsOf();
  assert.equal(slots.length, 17);
  assert.equal(slots[0].startsAtLocal, "2031-01-15T09:00");
  assert.equal(slots[0].startsAt.toISOString(), "2031-01-15T14:00:00.000Z");
  assert.equal(slots.at(-1).startsAtLocal, "2031-01-15T17:00");
  assert.equal(slots.at(-1).startsAt.toISOString(), "2031-01-15T22:00:00.000Z");
  assert.equal(slots.some((slot) => slot.startsAtLocal === "2031-01-15T17:30"), false);
});

test("domingo cerrado: no genera slots", () => {
  assert.equal(slotsOf({ from: SUNDAY, to: SUNDAY }).length, 0);
});

test("rango que cruza medianoche incluye ambos días en orden", () => {
  const slots = slotsOf({ from: WEDNESDAY, to: THURSDAY });
  assert.equal(slots.length, 34);
  assert.equal(slots[16].startsAtLocal, "2031-01-15T17:00");
  assert.equal(slots[17].startsAtLocal, "2031-01-16T09:00");
  for (let index = 1; index < slots.length; index += 1) {
    assert.ok(slots[index - 1].startsAt.getTime() <= slots[index].startsAt.getTime(), `orden en ${index}`);
  }
});

test("un slot no puede terminar después del cierre ni cruzar medianoche", () => {
  const slots = slotsOf({
    openingHours: [{ day: 3, open: "20:00", close: "23:30" }],
    durationMinutes: 60,
    stepMinutes: 30,
  });
  assert.deepEqual(slots.map((slot) => slot.startsAtLocal), [
    "2031-01-15T20:00",
    "2031-01-15T20:30",
    "2031-01-15T21:00",
    "2031-01-15T21:30",
    "2031-01-15T22:00",
    "2031-01-15T22:30",
  ]);
});

test("excluye slots ocupados por citas activas", () => {
  const slots = slotsOf({
    openingHours: [{ day: 3, open: "09:00", close: "12:00" }],
    durationMinutes: 30,
    stepMinutes: 30,
    busy: [busyRange("2031-01-15T09:45", "2031-01-15T10:15")],
  });
  assert.deepEqual(slots.map((slot) => slot.startsAtLocal), [
    "2031-01-15T09:00",
    "2031-01-15T10:30",
    "2031-01-15T11:00",
    "2031-01-15T11:30",
  ]);
});

test("nunca devuelve horarios ya pasados (reloj inyectable)", () => {
  const now = localToUtc("2031-01-15T12:10", TIME_ZONE);
  const slots = slotsOf({ now });
  assert.equal(slots[0].startsAtLocal, "2031-01-15T12:30");
  assert.equal(slots.length, 10);
  const closed = slotsOf({ now: localToUtc("2031-01-15T18:30", TIME_ZONE) });
  assert.equal(closed.length, 0);
});

test("respeta la duración y el paso pedidos", () => {
  const slots = slotsOf({ durationMinutes: 45, stepMinutes: 60 });
  assert.deepEqual(slots.map((slot) => slot.startsAtLocal), [
    "2031-01-15T09:00",
    "2031-01-15T10:00",
    "2031-01-15T11:00",
    "2031-01-15T12:00",
    "2031-01-15T13:00",
    "2031-01-15T14:00",
    "2031-01-15T15:00",
    "2031-01-15T16:00",
    "2031-01-15T17:00",
  ]);
});

test("zona horaria distinta: America/Mexico_City", () => {
  const slots = slotsOf({ timeZone: "America/Mexico_City", durationMinutes: 30, stepMinutes: 30 });
  assert.equal(slots.length, 18);
  assert.equal(slots[0].startsAtLocal, "2031-01-15T09:00");
  assert.equal(slots[0].startsAt.toISOString(), "2031-01-15T15:00:00.000Z");
  assert.equal(slots.at(-1).startsAtLocal, "2031-01-15T17:30");
  assert.equal(slots.at(-1).startsAt.toISOString(), "2031-01-15T23:30:00.000Z");
});

test("máximo 300 slots, ordenados", () => {
  const slots = slotsOf({ from: "2031-01-01", to: "2031-02-01" });
  assert.equal(slots.length, MAX_AVAILABILITY_SLOTS);
  for (let index = 1; index < slots.length; index += 1) {
    assert.ok(slots[index - 1].startsAt.getTime() <= slots[index].startsAt.getTime(), `orden en ${index}`);
  }
});

test("un bloque ocupado que empieza antes del rango también excluye solapes", () => {
  const slots = slotsOf({ busy: [busyRange("2031-01-15T08:30", "2031-01-15T09:20")] });
  assert.equal(slots[0].startsAtLocal, "2031-01-15T09:30");
});

test("businessDayNumber usa 1=lunes y 7=domingo", () => {
  assert.equal(businessDayNumber("2031-01-13"), 1);
  assert.equal(businessDayNumber(WEDNESDAY), 3);
  assert.equal(businessDayNumber(SUNDAY), 7);
});

test("normaliza el horario de atención y aplica valores por defecto", () => {
  const defaults = normalizeOpeningHours(undefined);
  assert.equal(defaults.ok, true);
  assert.deepEqual(defaults.value, [
    { day: 1, open: "09:00", close: "18:00" },
    { day: 2, open: "09:00", close: "18:00" },
    { day: 3, open: "09:00", close: "18:00" },
    { day: 4, open: "09:00", close: "18:00" },
    { day: 5, open: "09:00", close: "18:00" },
    { day: 6, open: "09:00", close: "18:00" },
  ]);

  const custom = normalizeOpeningHours([
    { day: 2, open: "10:00", close: "14:00" },
    { day: 1, open: "9:00", close: "18:00" },
  ]);
  assert.equal(custom.ok, true);
  assert.deepEqual(custom.value, [
    { day: 1, open: "09:00", close: "18:00" },
    { day: 2, open: "10:00", close: "14:00" },
  ]);
});

test("rechaza horarios de atención inválidos", () => {
  const invalidCases = [
    "09:00",
    [null],
    [{ day: 0, open: "09:00", close: "18:00" }],
    [{ day: 8, open: "09:00", close: "18:00" }],
    [{ day: 1, open: "18:00", close: "09:00" }],
    [{ day: 1, open: "25:00", close: "18:00" }],
    [{ day: 1, open: "09:00", close: "18:60" }],
    [{ day: 1, open: "09:00" }],
    [{ day: "1", open: "09:00", close: "18:00" }],
  ];
  for (const value of invalidCases) {
    assert.equal(normalizeOpeningHours(value).ok, false, JSON.stringify(value));
  }
});

test("resuelve horario y paso con fallback para tenants antiguos", () => {
  assert.deepEqual(resolveOpeningHours({}), DEFAULT_OPENING_HOURS);
  assert.deepEqual(resolveOpeningHours({ openingHours: [{ day: 7, open: "10:00", close: "13:00" }] }), [
    { day: 7, open: "10:00", close: "13:00" },
  ]);
  assert.equal(resolveSlotStepMinutes({}), 30);
  assert.equal(resolveSlotStepMinutes({ slotStepMinutes: 15 }), 15);
  assert.equal(resolveSlotStepMinutes({ slotStepMinutes: 4 }), 30);
  assert.equal(resolveSlotStepMinutes({ slotStepMinutes: "15" }), 30);
});

test("valida la consulta de disponibilidad", () => {
  const result = validateAvailabilityQuery(
    { from: WEDNESDAY, to: WEDNESDAY, durationMinutes: "45", stepMinutes: "30" },
    {},
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { from: WEDNESDAY, to: WEDNESDAY, durationMinutes: 45, stepMinutes: 30 });

  const defaultStep = validateAvailabilityQuery({ from: WEDNESDAY, to: WEDNESDAY, durationMinutes: "45" }, { defaultStepMinutes: 15 });
  assert.equal(defaultStep.value.stepMinutes, 15);

  const oneMonth = validateAvailabilityQuery({ from: "2031-01-01", to: "2031-02-01", durationMinutes: "30" }, {});
  assert.equal(oneMonth.ok, true);
  const tooLong = validateAvailabilityQuery({ from: "2031-01-01", to: "2031-02-02", durationMinutes: "30" }, {});
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.code, "invalid_range");
});

test("códigos de error de la consulta de disponibilidad", () => {
  const cases = [
    ["invalid_range", {}],
    ["invalid_range", { from: WEDNESDAY }],
    ["invalid_range", { from: "2031-02-30", to: WEDNESDAY }],
    ["invalid_range", { from: THURSDAY, to: WEDNESDAY }],
    ["invalid_duration", { from: WEDNESDAY, to: WEDNESDAY }],
    ["invalid_duration", { from: WEDNESDAY, to: WEDNESDAY, durationMinutes: "4" }],
    ["invalid_duration", { from: WEDNESDAY, to: WEDNESDAY, durationMinutes: "481" }],
    ["invalid_duration", { from: WEDNESDAY, to: WEDNESDAY, durationMinutes: "45.5" }],
    ["invalid_step", { from: WEDNESDAY, to: WEDNESDAY, durationMinutes: "45", stepMinutes: "4" }],
    ["invalid_step", { from: WEDNESDAY, to: WEDNESDAY, durationMinutes: "45", stepMinutes: "241" }],
    ["invalid_step", { from: WEDNESDAY, to: WEDNESDAY, durationMinutes: "45", stepMinutes: "30.5" }],
  ];
  for (const [code, query] of cases) {
    const result = validateAvailabilityQuery(query, {});
    assert.equal(result.ok, false, JSON.stringify(query));
    assert.equal(result.code, code, JSON.stringify(query));
  }
});

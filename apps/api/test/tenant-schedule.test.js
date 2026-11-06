import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OPENING_HOURS,
  generateAvailabilitySlots,
  resolveOpeningHours,
  resolveSlotStepMinutes,
  validateTenantScheduleUpdate,
} from "../src/availability.js";

const SUNDAY = "2031-01-19";

test("tenants antiguos sin campos usan el horario y paso por defecto", () => {
  assert.deepEqual(resolveOpeningHours({}), DEFAULT_OPENING_HOURS);
  assert.deepEqual(resolveOpeningHours({ openingHours: "horario-roto" }), DEFAULT_OPENING_HOURS);
  assert.equal(resolveSlotStepMinutes({}), 30);
  assert.equal(resolveSlotStepMinutes({ slotStepMinutes: 4 }), 30);
  assert.equal(resolveSlotStepMinutes({ slotStepMinutes: "30" }), 30);
});

test("acepta horario y paso válidos", () => {
  const both = validateTenantScheduleUpdate({
    openingHours: [
      { day: 7, open: "10:00", close: "14:00" },
      { day: 1, open: "9:00", close: "18:00" },
    ],
    slotStepMinutes: 15,
  });
  assert.equal(both.ok, true);
  assert.deepEqual(both.value.openingHours, [
    { day: 1, open: "09:00", close: "18:00" },
    { day: 7, open: "10:00", close: "14:00" },
  ]);
  assert.equal(both.value.slotStepMinutes, 15);

  const onlyHours = validateTenantScheduleUpdate({ openingHours: [] });
  assert.equal(onlyHours.ok, true);
  assert.deepEqual(onlyHours.value, { openingHours: [] });

  const onlyStep = validateTenantScheduleUpdate({ slotStepMinutes: 60 });
  assert.equal(onlyStep.ok, true);
  assert.deepEqual(onlyStep.value, { slotStepMinutes: 60 });
});

test("rechaza día repetido con invalid_hours", () => {
  const result = validateTenantScheduleUpdate({
    openingHours: [
      { day: 3, open: "09:00", close: "12:00" },
      { day: 3, open: "14:00", close: "18:00" },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_hours");
});

test("rechaza horas inválidas con invalid_hours", () => {
  const cases = [
    [{ day: 0, open: "09:00", close: "18:00" }],
    [{ day: 8, open: "09:00", close: "18:00" }],
    [{ day: 1, open: "18:00", close: "18:00" }],
    [{ day: 1, open: "18:00", close: "09:00" }],
    [{ day: 1, open: "25:00", close: "18:00" }],
    [{ day: 1, open: "09:00", close: "18:60" }],
    [{ day: 1, open: "09:00" }],
    "09:00-18:00",
    [null],
  ];
  for (const openingHours of cases) {
    const result = validateTenantScheduleUpdate({ openingHours });
    assert.equal(result.ok, false, JSON.stringify(openingHours));
    assert.equal(result.code, "invalid_hours", JSON.stringify(openingHours));
  }
});

test("rechaza paso fuera de rango con invalid_slot_step", () => {
  for (const slotStepMinutes of [4, 241, 0, "30", 30.5, null]) {
    const result = validateTenantScheduleUpdate({ slotStepMinutes });
    assert.equal(result.ok, false, String(slotStepMinutes));
    assert.equal(result.code, "invalid_slot_step", String(slotStepMinutes));
  }
});

test("sin campos del horario devuelve empty_update", () => {
  for (const body of [{}, { name: "otro" }, null, undefined, []]) {
    const result = validateTenantScheduleUpdate(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.code, "empty_update", JSON.stringify(body));
  }
});

test("domingo 10:00-14:00 genera huecos ese domingo", () => {
  const slots = generateAvailabilitySlots({
    from: SUNDAY,
    to: SUNDAY,
    timeZone: "America/Bogota",
    openingHours: [{ day: 7, open: "10:00", close: "14:00" }],
    durationMinutes: 30,
    stepMinutes: 30,
    now: new Date(0),
  });
  assert.equal(slots.length, 8);
  assert.equal(slots[0].startsAtLocal, "2031-01-19T10:00");
  assert.equal(slots[0].startsAt.toISOString(), "2031-01-19T15:00:00.000Z");
  assert.equal(slots.at(-1).startsAtLocal, "2031-01-19T13:30");
});

test("domingo cerrado devuelve lista vacía (no es error)", () => {
  const slots = generateAvailabilitySlots({
    from: SUNDAY,
    to: SUNDAY,
    timeZone: "America/Bogota",
    openingHours: [],
    durationMinutes: 30,
    stepMinutes: 30,
    now: new Date(0),
  });
  assert.deepEqual(slots, []);
});

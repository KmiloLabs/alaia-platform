import test from "node:test";
import assert from "node:assert/strict";
import {
  blocksAvailability,
  findAppointmentConflict,
  isOverlapping,
  normalizeProfessionalId,
  sameProfessionalSlot,
} from "../src/appointment-conflicts.js";
import { DEFAULT_OPENING_HOURS, generateAvailabilitySlots } from "../src/availability.js";
import { localToUtc } from "../src/timezone.js";

const DATE = "2031-01-15";

function snapshot(id, data) {
  return { id, data: () => data };
}

function appointment(id, { startsAt, endsAt, startsAtMs, endsAtMs, professionalId = null, status = "scheduled" }) {
  const start = startsAt ?? startsAtMs;
  const end = endsAt ?? endsAtMs;
  return snapshot(id, {
    startsAt: start instanceof Date ? start : new Date(start),
    endsAt: end instanceof Date ? end : new Date(end),
    professionalId,
    status,
  });
}

const BASE_RANGE = {
  startsAtMs: Date.parse("2031-01-15T15:00:00.000Z"),
  endsAtMs: Date.parse("2031-01-15T15:45:00.000Z"),
};

test("normaliza el professionalId y compara cupos", () => {
  assert.equal(normalizeProfessionalId(" pro_1 "), "pro_1");
  assert.equal(normalizeProfessionalId(""), null);
  assert.equal(normalizeProfessionalId(undefined), null);
  assert.equal(normalizeProfessionalId(42), null);

  assert.equal(sameProfessionalSlot(null, null), true);
  assert.equal(sameProfessionalSlot(undefined, ""), true);
  assert.equal(sameProfessionalSlot("pro_1", "pro_1"), true);
  assert.equal(sameProfessionalSlot("pro_1", "pro_2"), false);
  assert.equal(sameProfessionalSlot("pro_1", null), false);
  assert.equal(sameProfessionalSlot(null, "pro_1"), false);
});

test("solapamiento de instantes", () => {
  assert.equal(isOverlapping(100, 200, 150, 250), true);
  assert.equal(isOverlapping(100, 200, 200, 300), false);
  assert.equal(isOverlapping(100, 200, 50, 100), false);
});

test("dos citas sin asignar se cruzan entre sí", () => {
  const docs = [appointment("a", { ...BASE_RANGE })];
  const conflict = findAppointmentConflict(docs, { ...BASE_RANGE, professionalId: null });
  assert.equal(conflict.doc.id, "a");
});

test("una cita asignada y una sin asignar no se cruzan", () => {
  const assigned = [appointment("a", { ...BASE_RANGE, professionalId: "pro_1" })];
  assert.equal(findAppointmentConflict(assigned, { ...BASE_RANGE, professionalId: null }), null);

  const unassigned = [appointment("b", { ...BASE_RANGE })];
  assert.equal(findAppointmentConflict(unassigned, { ...BASE_RANGE, professionalId: "pro_1" }), null);
});

test("mismo profesional se cruza; distinto profesional no", () => {
  const docs = [
    appointment("a", { ...BASE_RANGE, professionalId: "pro_1" }),
    appointment("b", { ...BASE_RANGE, professionalId: "pro_2" }),
  ];
  assert.equal(findAppointmentConflict(docs, { ...BASE_RANGE, professionalId: "pro_1" }).doc.id, "a");
  assert.equal(findAppointmentConflict(docs, { ...BASE_RANGE, professionalId: "pro_2" }).doc.id, "b");
  assert.equal(findAppointmentConflict(docs, { ...BASE_RANGE, professionalId: "pro_3" }), null);
});

test("ignora la propia cita, las canceladas y el no solapamiento", () => {
  const docs = [appointment("a", { ...BASE_RANGE, professionalId: "pro_1" })];
  assert.equal(findAppointmentConflict(docs, { ...BASE_RANGE, professionalId: "pro_1", ignoreAppointmentId: "a" }), null);

  const cancelled = [appointment("c", { ...BASE_RANGE, professionalId: "pro_1", status: "cancelled" })];
  assert.equal(findAppointmentConflict(cancelled, { ...BASE_RANGE, professionalId: "pro_1" }), null);

  const later = [appointment("d", { ...BASE_RANGE, professionalId: "pro_1", startsAt: new Date(Date.parse("2031-01-15T16:00:00.000Z")), endsAt: new Date(Date.parse("2031-01-15T16:45:00.000Z")) })];
  assert.equal(findAppointmentConflict(later, { ...BASE_RANGE, professionalId: "pro_1" }), null);
});

test("blocksAvailability: sin filtro bloquea todo; con filtro bloquea propio y sin asignar", () => {
  const own = { status: "scheduled", professionalId: "pro_1" };
  const other = { status: "scheduled", professionalId: "pro_2" };
  const unassigned = { status: "scheduled", professionalId: null };
  const cancelled = { status: "cancelled", professionalId: "pro_1" };

  assert.equal(blocksAvailability(own, null), true);
  assert.equal(blocksAvailability(other, null), true);
  assert.equal(blocksAvailability(unassigned, null), true);
  assert.equal(blocksAvailability(cancelled, null), false);

  assert.equal(blocksAvailability(own, "pro_1"), true);
  assert.equal(blocksAvailability(unassigned, "pro_1"), true);
  assert.equal(blocksAvailability(other, "pro_1"), false);
  assert.equal(blocksAvailability(cancelled, "pro_1"), false);
});

test("disponibilidad filtrada por profesional con GenerateAvailabilitySlots", () => {
  const appointments = [
    { status: "scheduled", professionalId: "pro_a", startsAt: localToUtc(`${DATE}T10:00`, "America/Bogota"), endsAt: localToUtc(`${DATE}T10:30`, "America/Bogota") },
    { status: "scheduled", professionalId: "pro_b", startsAt: localToUtc(`${DATE}T11:00`, "America/Bogota"), endsAt: localToUtc(`${DATE}T11:30`, "America/Bogota") },
    { status: "scheduled", professionalId: null, startsAt: localToUtc(`${DATE}T09:30`, "America/Bogota"), endsAt: localToUtc(`${DATE}T10:00`, "America/Bogota") },
  ];

  const slotsFor = (professionalId) => {
    const busy = appointments
      .filter((data) => blocksAvailability(data, professionalId))
      .map((data) => ({ start: data.startsAt, end: data.endsAt }));
    return generateAvailabilitySlots({
      from: DATE,
      to: DATE,
      timeZone: "America/Bogota",
      openingHours: [{ day: 3, open: "09:00", close: "12:00" }],
      durationMinutes: 30,
      stepMinutes: 30,
      now: new Date(0),
      busy,
    }).map((slot) => slot.startsAtLocal.slice(11));
  };

  // A: le bloquean su cita 10:00-10:30 y la sin asignar 09:30-10:00.
  assert.deepEqual(slotsFor("pro_a"), ["09:00", "10:30", "11:00", "11:30"]);
  // B: le bloquean su cita 11:00-11:30 y la sin asignar 09:30-10:00.
  assert.deepEqual(slotsFor("pro_b"), ["09:00", "10:00", "10:30", "11:30"]);
  // Sin filtro: todas las citas ocupan el hueco del negocio.
  assert.deepEqual(slotsFor(null), ["09:00", "10:30", "11:30"]);
});

test("DEFAULT_OPENING_HOURS sigue disponible para las pruebas de disponibilidad", () => {
  assert.equal(DEFAULT_OPENING_HOURS.length, 6);
});

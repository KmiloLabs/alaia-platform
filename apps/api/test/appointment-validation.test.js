import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveAppointmentId,
  validateAppointmentInput,
  validateAppointmentRange,
  validateRescheduleInput,
} from "../src/appointment-validation.js";

const TIME_ZONE = "America/Bogota";

function validBody(overrides = {}) {
  return {
    customerName: "Mariana López",
    customerPhone: "+57 300 000 0000",
    serviceName: "Corte clásico",
    startsAt: "2026-11-06T14:00",
    durationMinutes: 45,
    priceCOP: 50000,
    notes: "",
    ...overrides,
  };
}

test("acepta una cita válida y normaliza los campos", () => {
  const result = validateAppointmentInput(validBody({
    customerName: "  Mariana López ",
    customerPhone: "  +57 300 000 0000  ",
    serviceName: " Corte clásico ",
    notes: "  Primera visita  ",
    clientRequestId: "  req-1  ",
  }), TIME_ZONE);

  assert.equal(result.ok, true);
  assert.equal(result.value.customerName, "Mariana López");
  assert.equal(result.value.customerPhone, "+57 300 000 0000");
  assert.equal(result.value.serviceName, "Corte clásico");
  assert.equal(result.value.startsAtLocal, "2026-11-06T14:00");
  assert.equal(result.value.startsAtUtc.toISOString(), "2026-11-06T19:00:00.000Z");
  assert.equal(result.value.endsAtUtc.toISOString(), "2026-11-06T19:45:00.000Z");
  assert.equal(result.value.durationMinutes, 45);
  assert.equal(result.value.priceCOP, 50000);
  assert.equal(result.value.notes, "Primera visita");
  assert.equal(result.value.clientRequestId, "req-1");
});

test("acepta los límites del contrato", () => {
  const shortest = validateAppointmentInput(validBody({ durationMinutes: 5, priceCOP: 0 }), TIME_ZONE);
  assert.equal(shortest.ok, true);
  const longest = validateAppointmentInput(validBody({ durationMinutes: 480, priceCOP: 10_000_000 }), TIME_ZONE);
  assert.equal(longest.ok, true);
  assert.equal(longest.value.endsAtUtc.getTime() - longest.value.startsAtUtc.getTime(), 480 * 60 * 1000);
});

test("campos opcionales ausentes quedan en null o vacío", () => {
  const body = validBody();
  delete body.customerPhone;
  delete body.notes;
  const result = validateAppointmentInput(body, TIME_ZONE);
  assert.equal(result.ok, true);
  assert.equal(result.value.customerPhone, null);
  assert.equal(result.value.notes, "");
  assert.equal(result.value.clientRequestId, null);
});

test("rechaza nombre inválido con invalid_name", () => {
  for (const customerName of [undefined, "", " A ", "x", "a".repeat(81), 42]) {
    const result = validateAppointmentInput(validBody({ customerName }), TIME_ZONE);
    assert.equal(result.ok, false, String(customerName));
    assert.equal(result.code, "invalid_name");
  }
});

test("rechaza servicio inválido con invalid_service", () => {
  for (const serviceName of [undefined, "", " x ", "a".repeat(81), 7]) {
    const result = validateAppointmentInput(validBody({ serviceName }), TIME_ZONE);
    assert.equal(result.ok, false, String(serviceName));
    assert.equal(result.code, "invalid_service");
  }
});

test("rechaza inicio inválido con invalid_start", () => {
  for (const startsAt of [
    undefined,
    "",
    "2026-11-06",
    "2026-11-06T25:00",
    "2026-11-06T14:60",
    "2026-02-30T10:00",
    "2026-11-06T14:00Z",
    "2026-11-06 14:00",
    1759766400000,
  ]) {
    const result = validateAppointmentInput(validBody({ startsAt }), TIME_ZONE);
    assert.equal(result.ok, false, String(startsAt));
    assert.equal(result.code, "invalid_start");
  }
});

test("rechaza duración inválida con invalid_duration", () => {
  for (const durationMinutes of [undefined, null, 4, 481, 45.5, "45", Number.NaN]) {
    const result = validateAppointmentInput(validBody({ durationMinutes }), TIME_ZONE);
    assert.equal(result.ok, false, String(durationMinutes));
    assert.equal(result.code, "invalid_duration");
  }
});

test("rechaza precio inválido con invalid_price", () => {
  for (const priceCOP of [undefined, null, -1, 10_000_001, 50.5, "50000", Number.NaN]) {
    const result = validateAppointmentInput(validBody({ priceCOP }), TIME_ZONE);
    assert.equal(result.ok, false, String(priceCOP));
    assert.equal(result.code, "invalid_price");
  }
});

test("el orden de validación es nombre, servicio, inicio, duración y precio", () => {
  const result = validateAppointmentInput({ customerName: "A", serviceName: "B" }, TIME_ZONE);
  assert.equal(result.code, "invalid_name");
});

test("acepta rango de fechas local del negocio", () => {
  const result = validateAppointmentRange({ from: "2026-11-06", to: "2026-11-06" }, TIME_ZONE);
  assert.equal(result.ok, true);
  assert.equal(result.value.start.toISOString(), "2026-11-06T05:00:00.000Z");
  assert.equal(result.value.end.toISOString(), "2026-11-07T05:00:00.000Z");
});

test("rechaza rango inválido con invalid_range", () => {
  const cases = [
    {},
    { from: "2026-11-06" },
    { to: "2026-11-06" },
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-11-06", to: "06/11/2026" },
    { from: "2026-11-08", to: "2026-11-06" },
    { from: ["2026-11-06"], to: "2026-11-06" },
    { from: 20261106, to: "2026-11-06" },
  ];
  for (const query of cases) {
    const result = validateAppointmentRange(query, TIME_ZONE);
    assert.equal(result.ok, false, JSON.stringify(query));
    assert.equal(result.code, "invalid_range");
  }
});

test("clientRequestId genera un ID determinista y distinto por solicitud", () => {
  const first = deriveAppointmentId("req-1");
  const second = deriveAppointmentId("req-1");
  const other = deriveAppointmentId("req-2");
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^appt_[a-f0-9]{24}$/);
});

test("no muta el cuerpo recibido", () => {
  const body = validBody();
  const snapshot = JSON.stringify(body);
  validateAppointmentInput(body, TIME_ZONE);
  assert.equal(JSON.stringify(body), snapshot);
});

test("acepta reprogramación con y sin duración", () => {
  const withDuration = validateRescheduleInput({ startsAt: "2026-11-07T15:30", durationMinutes: 60 }, TIME_ZONE);
  assert.equal(withDuration.ok, true);
  assert.equal(withDuration.value.startsAtLocal, "2026-11-07T15:30");
  assert.equal(withDuration.value.startsAtUtc.toISOString(), "2026-11-07T20:30:00.000Z");
  assert.equal(withDuration.value.durationMinutes, 60);

  const withoutDuration = validateRescheduleInput({ startsAt: "2026-11-07T15:30" }, TIME_ZONE);
  assert.equal(withoutDuration.ok, true);
  assert.equal(withoutDuration.value.durationMinutes, null);

  const withSeconds = validateRescheduleInput({ startsAt: "2026-11-07T15:30:45" }, TIME_ZONE);
  assert.equal(withSeconds.ok, true);
  assert.equal(withSeconds.value.startsAtLocal, "2026-11-07T15:30");
});

test("rechaza reprogramación con hora o duración inválidas", () => {
  for (const startsAt of [undefined, "", "2026-11-07", "2026-11-07T24:00", "2026-13-01T10:00", "2026-11-07T10:00Z"]) {
    const result = validateRescheduleInput({ startsAt }, TIME_ZONE);
    assert.equal(result.ok, false, String(startsAt));
    assert.equal(result.code, "invalid_start");
  }
  for (const durationMinutes of [4, 481, 45.5, "45", null]) {
    const result = validateRescheduleInput({ startsAt: "2026-11-07T15:30", durationMinutes }, TIME_ZONE);
    assert.equal(result.ok, false, String(durationMinutes));
    assert.equal(result.code, "invalid_duration");
  }
});

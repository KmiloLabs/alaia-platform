import test from "node:test";
import assert from "node:assert/strict";
import { localToUtc } from "../src/timezone.js";
import {
  buildSettlementPreview,
  computeCommission,
  daysBetween,
  daysInMonth,
  validateSettlementRange,
} from "../src/settlement.js";

const BOGOTA = "America/Bogota";

function appointment(localDateTime, { priceCOP = 0, professionalId = null, professionalName = null, status = "scheduled", timeZone = BOGOTA } = {}) {
  return {
    startsAt: localToUtc(localDateTime, timeZone),
    priceCOP,
    professionalId,
    professionalName,
    status,
  };
}

test("valida el rango de liquidación", () => {
  const valid = validateSettlementRange({ from: "2026-11-01", to: "2026-11-30" });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, { from: "2026-11-01", to: "2026-11-30" });

  const sameDay = validateSettlementRange({ from: "2026-11-01", to: "2026-11-01" });
  assert.equal(sameDay.ok, true);

  const maxRange = validateSettlementRange({ from: "2026-01-01", to: "2026-04-03" });
  assert.equal(maxRange.ok, true); // 92 días de diferencia

  const tooLong = validateSettlementRange({ from: "2026-01-01", to: "2026-04-04" });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.code, "invalid_range");

  const inverted = validateSettlementRange({ from: "2026-11-30", to: "2026-11-01" });
  assert.equal(inverted.ok, false);
  assert.equal(inverted.code, "invalid_range");

  for (const query of [{}, { from: "2026-11-01" }, { to: "2026-11-30" }, { from: "2026-02-30", to: "2026-03-01" }, { from: "hola", to: "2026-11-01" }]) {
    const result = validateSettlementRange(query);
    assert.equal(result.ok, false, JSON.stringify(query));
    assert.equal(result.code, "invalid_date", JSON.stringify(query));
  }
});

test("comisión percentage, fixed, rent y mixed con números exactos", () => {
  assert.deepEqual(
    computeCommission({ config: { type: "percentage", percent: 50 }, gross: 1_000_000, services: 3, daysInRange: 30, daysInMonth: 30 }),
    { commission: 500_000, rent: 0 },
  );
  assert.deepEqual(
    computeCommission({ config: { type: "fixed", amountCOP: 15_000 }, gross: 120_000, services: 4, daysInRange: 30, daysInMonth: 30 }),
    { commission: 60_000, rent: 0 },
  );
  assert.deepEqual(
    computeCommission({ config: { type: "rent", rentCOP: 300_000 }, gross: 500_000, services: 5, daysInRange: 30, daysInMonth: 30 }),
    { commission: 0, rent: 300_000 },
  );
  assert.deepEqual(
    computeCommission({ config: { type: "rent", rentCOP: 300_000 }, gross: 500_000, services: 5, daysInRange: 10, daysInMonth: 30 }),
    { commission: 0, rent: 100_000 },
  );
  assert.deepEqual(
    computeCommission({ config: { type: "mixed", percent: 20, rentCOP: 300_000 }, gross: 500_000, services: 2, daysInRange: 10, daysInMonth: 30 }),
    { commission: 100_000, rent: 100_000 },
  );
  // Redondeo del porcentaje y del alquiler.
  assert.deepEqual(
    computeCommission({ config: { type: "percentage", percent: 33 }, gross: 100_000, services: 1, daysInRange: 30, daysInMonth: 30 }),
    { commission: 33_000, rent: 0 },
  );
  assert.deepEqual(
    computeCommission({ config: { type: "rent", rentCOP: 100_000 }, gross: 0, services: 0, daysInRange: 1, daysInMonth: 30 }),
    { commission: 0, rent: 3_333 },
  );
});

test("liquidación del mes completo con porcentaje, fijo, sin asignar y cancelada", () => {
  const preview = buildSettlementPreview({
    from: "2026-11-01",
    to: "2026-11-30",
    timeZone: BOGOTA,
    appointments: [
      appointment("2026-11-03T10:00", { priceCOP: 50000, professionalId: "pro_a", professionalName: "Andrés" }),
      appointment("2026-11-05T10:00", { priceCOP: 50000, professionalId: "pro_a", professionalName: "Andrés" }),
      appointment("2026-11-06T10:00", { priceCOP: 40000, professionalId: "pro_b", professionalName: "Camila" }),
      appointment("2026-11-07T10:00", { priceCOP: 30000 }),
      appointment("2026-11-08T10:00", { priceCOP: 999999, professionalId: "pro_a", status: "cancelled" }),
      appointment("2026-12-01T10:00", { priceCOP: 77777, professionalId: "pro_a" }),
    ],
    professionals: [
      { professionalId: "pro_a", name: "Andrés", active: true, commission: { type: "percentage", percent: 50, amountCOP: 0, rentCOP: 0 } },
      { professionalId: "pro_b", name: "Camila", active: false, commission: { type: "fixed", amountCOP: 15000, percent: 0, rentCOP: 0 } },
      { professionalId: "pro_c", name: "Sin citas", active: true, commission: { type: "percentage", percent: 10, amountCOP: 0, rentCOP: 0 } },
    ],
  });

  assert.equal(preview.from, "2026-11-01");
  assert.equal(preview.to, "2026-11-30");
  assert.equal(preview.timeZone, BOGOTA);
  assert.deepEqual(preview.business, { services: 4, gross: 170000 });
  assert.deepEqual(preview.unassigned, { services: 1, gross: 30000 });

  assert.deepEqual(preview.professionals, [
    { professionalId: "pro_a", name: "Andrés", services: 2, gross: 100000, commission: 50000, rent: 0, net: 50000 },
    { professionalId: "pro_b", name: "Camila", services: 1, gross: 40000, commission: 15000, rent: 0, net: 15000 },
  ]);
});

test("alquiler prorrateado en rango parcial y neto negativo", () => {
  const preview = buildSettlementPreview({
    from: "2026-11-01",
    to: "2026-11-10",
    timeZone: BOGOTA,
    appointments: [
      appointment("2026-11-03T10:00", { priceCOP: 80000, professionalId: "pro_rent", professionalName: "Rent" }),
      appointment("2026-11-04T10:00", { priceCOP: 20000, professionalId: "pro_mixed", professionalName: "Mixto" }),
    ],
    professionals: [
      { professionalId: "pro_rent", name: "Rent", active: true, commission: { type: "rent", rentCOP: 300000, percent: 0, amountCOP: 0 } },
      { professionalId: "pro_mixed", name: "Mixto", active: true, commission: { type: "mixed", percent: 20, rentCOP: 300000 } },
    ],
  });

  // Nov tiene 30 días; el rango del 1 al 10 son 10 días → alquiler 100.000.
  assert.deepEqual(preview.professionals, [
    { professionalId: "pro_mixed", name: "Mixto", services: 1, gross: 20000, commission: 4000, rent: 100000, net: -96000 },
    { professionalId: "pro_rent", name: "Rent", services: 1, gross: 80000, commission: 0, rent: 100000, net: -100000 },
  ]);
  assert.deepEqual(preview.business, { services: 2, gross: 100000 });
});

test("las citas completed cuentan y las no_show no", () => {
  const preview = buildSettlementPreview({
    from: "2026-11-01",
    to: "2026-11-30",
    timeZone: BOGOTA,
    appointments: [
      appointment("2026-11-03T10:00", { priceCOP: 100000, professionalId: "pro_a", professionalName: "Andrés", status: "scheduled" }),
      appointment("2026-11-04T10:00", { priceCOP: 50000, professionalId: "pro_a", professionalName: "Andrés", status: "completed" }),
      appointment("2026-11-05T10:00", { priceCOP: 99999, professionalId: "pro_a", professionalName: "Andrés", status: "no_show" }),
      appointment("2026-11-06T10:00", { priceCOP: 88888, professionalId: "pro_a", professionalName: "Andrés", status: "cancelled" }),
    ],
    professionals: [
      { professionalId: "pro_a", name: "Andrés", commission: { type: "percentage", percent: 50, amountCOP: 0, rentCOP: 0 } },
    ],
  });

  assert.deepEqual(preview.business, { services: 2, gross: 150000 });
  assert.deepEqual(preview.professionals, [
    { professionalId: "pro_a", name: "Andrés", services: 2, gross: 150000, commission: 75000, rent: 0, net: 75000 },
  ]);
});

test("la zona horaria del negocio decide qué citas entran", () => {  // 2026-11-01T05:30Z = 00:30 del 1 de noviembre en Bogotá y 23:30 del 31 de octubre en Ciudad de México.
  const instant = { startsAt: new Date("2026-11-01T05:30:00.000Z"), priceCOP: 10000, professionalId: "pro_a", professionalName: "Andrés", status: "scheduled" };
  const professionals = [{ professionalId: "pro_a", name: "Andrés", commission: { type: "percentage", percent: 50 } }];

  const bogota = buildSettlementPreview({ from: "2026-11-01", to: "2026-11-30", timeZone: BOGOTA, appointments: [instant], professionals });
  assert.deepEqual(bogota.business, { services: 1, gross: 10000 });

  const mexico = buildSettlementPreview({ from: "2026-11-01", to: "2026-11-30", timeZone: "America/Mexico_City", appointments: [instant], professionals });
  assert.deepEqual(mexico.business, { services: 0, gross: 0 });
  assert.deepEqual(mexico.professionals, []);
});

test("días del rango y del mes", () => {
  assert.equal(daysBetween("2026-11-01", "2026-11-30"), 29);
  assert.equal(daysBetween("2026-11-01", "2026-11-01"), 0);
  assert.equal(daysInMonth("2026-11-15"), 30);
  assert.equal(daysInMonth("2026-02-10"), 28);
  assert.equal(daysInMonth("2028-02-10"), 29);
});

test("sin citas el preview queda en ceros", () => {
  const preview = buildSettlementPreview({
    from: "2026-11-01",
    to: "2026-11-30",
    timeZone: BOGOTA,
    appointments: [],
    professionals: [],
  });
  assert.deepEqual(preview.business, { services: 0, gross: 0 });
  assert.deepEqual(preview.professionals, []);
  assert.deepEqual(preview.unassigned, { services: 0, gross: 0 });
});

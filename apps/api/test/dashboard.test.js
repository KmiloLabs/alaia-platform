import test from "node:test";
import assert from "node:assert/strict";
import { localToUtc } from "../src/timezone.js";
import {
  buildDashboardSummary,
  getDashboardRanges,
  nextMonthStart,
  resolveDashboardDate,
} from "../src/dashboard.js";

const BOGOTA = "America/Bogota";
const DATE = "2026-11-06"; // viernes; semana del lunes 2 al domingo 8

function appointment(localDateTime, { priceCOP = 0, serviceName = "Corte", status = "scheduled", timeZone = BOGOTA } = {}) {
  return { startsAt: localToUtc(localDateTime, timeZone), priceCOP, serviceName, status };
}

test("la fecha por defecto es hoy en la zona del negocio", () => {
  const result = resolveDashboardDate({ timeZone: BOGOTA, now: new Date("2026-11-06T15:00:00.000Z") });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { date: "2026-11-06", timeZone: BOGOTA });

  const explicit = resolveDashboardDate({ date: "2026-03-15", timeZone: BOGOTA });
  assert.equal(explicit.ok, true);
  assert.equal(explicit.value.date, "2026-03-15");

  for (const date of ["2026-02-30", "hola", "2026-11-6", 42]) {
    const invalid = resolveDashboardDate({ date, timeZone: BOGOTA });
    assert.equal(invalid.ok, false, String(date));
    assert.equal(invalid.status, 400);
    assert.equal(invalid.code, "invalid_date");
  }
});

test("rangos de hoy, semana lunes-domingo y mes", () => {
  const ranges = getDashboardRanges(DATE, BOGOTA);
  assert.equal(ranges.weekStartDate, "2026-11-02");
  assert.equal(ranges.weekEndDate, "2026-11-09");
  assert.equal(ranges.monthStartDate, "2026-11-01");
  assert.equal(ranges.monthEndDate, "2026-12-01");

  assert.equal(ranges.today.start.toISOString(), "2026-11-06T05:00:00.000Z");
  assert.equal(ranges.today.end.toISOString(), "2026-11-07T05:00:00.000Z");
  assert.equal(ranges.week.start.toISOString(), "2026-11-02T05:00:00.000Z");
  assert.equal(ranges.week.end.toISOString(), "2026-11-09T05:00:00.000Z");
  assert.equal(ranges.month.start.toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(ranges.month.end.toISOString(), "2026-12-01T05:00:00.000Z");
  // La consulta se acota al mes (la semana no cruza el borde en esta fecha).
  assert.equal(ranges.query.start.toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(ranges.query.end.toISOString(), "2026-12-01T05:00:00.000Z");
});

test("si la semana cruza de mes, la consulta incluye ese tramo", () => {
  const ranges = getDashboardRanges("2026-11-01", BOGOTA); // domingo; semana empieza el 26 de octubre
  assert.equal(ranges.weekStartDate, "2026-10-26");
  assert.equal(ranges.weekEndDate, "2026-11-02");
  assert.equal(ranges.monthStartDate, "2026-11-01");
  assert.equal(ranges.query.start.toISOString(), "2026-10-26T05:00:00.000Z");
});

test("el resumen cuenta hoy, semana, mes, canceladas e ingresos", () => {
  const summary = buildDashboardSummary({
    date: DATE,
    timeZone: BOGOTA,
    appointments: [
      appointment(`${DATE}T10:00`, { priceCOP: 50000, serviceName: "Corte" }),
      appointment(`${DATE}T12:00`, { priceCOP: 88888, serviceName: "Corte", status: "cancelled" }),
      appointment("2026-11-02T10:00", { priceCOP: 30000, serviceName: "Barba" }),
      appointment("2026-11-20T10:00", { priceCOP: 70000, serviceName: "Corte" }),
      appointment("2026-10-20T10:00", { priceCOP: 90000, serviceName: "Tinte" }),
    ],
    customers: { total: 25, newThisMonth: 6, newLast30Days: 9 },
  });

  assert.equal(summary.date, DATE);
  assert.equal(summary.timeZone, BOGOTA);
  assert.deepEqual(summary.appointments, { today: 1, week: 2, month: 3, cancelled: 1 });
  assert.deepEqual(summary.income, { today: 50000, week: 80000, month: 150000 });
  assert.deepEqual(summary.customers, { total: 25, newThisMonth: 6, newLast30Days: 9 });
  assert.deepEqual(summary.topServices, [
    { name: "Corte", count: 2, income: 120000 },
    { name: "Barba", count: 1, income: 30000 },
  ]);
});

test("una cita cancelada no suma ingresos ni aparece en topServices", () => {
  const summary = buildDashboardSummary({
    date: DATE,
    timeZone: BOGOTA,
    appointments: [
      appointment(`${DATE}T09:00`, { priceCOP: 50000, serviceName: "Corte" }),
      appointment(`${DATE}T11:00`, { priceCOP: 999999, serviceName: "Corte", status: "cancelled" }),
    ],
  });
  assert.deepEqual(summary.appointments, { today: 1, week: 1, month: 1, cancelled: 1 });
  assert.deepEqual(summary.income, { today: 50000, week: 50000, month: 50000 });
  assert.deepEqual(summary.topServices, [{ name: "Corte", count: 1, income: 50000 }]);
});

test("la misma semana que cruza de mes suma a la semana pero no al mes", () => {
  const summary = buildDashboardSummary({
    date: "2026-11-01",
    timeZone: BOGOTA,
    appointments: [
      appointment("2026-10-27T10:00", { priceCOP: 10000, serviceName: "Corte" }),
      appointment("2026-11-01T10:00", { priceCOP: 20000, serviceName: "Corte" }),
    ],
  });
  assert.deepEqual(summary.appointments, { today: 1, week: 2, month: 1, cancelled: 0 });
  assert.deepEqual(summary.income, { today: 20000, week: 30000, month: 20000 });
});

test("el cálculo usa la zona horaria del negocio", () => {
  // 2026-11-07T05:30Z = 23:30 del 6 de noviembre en Ciudad de México (UTC-6)
  // y 00:30 del 7 de noviembre en Bogotá (UTC-5).
  const instant = { startsAt: new Date("2026-11-07T05:30:00.000Z"), priceCOP: 10000, serviceName: "Corte", status: "scheduled" };
  const mexico = buildDashboardSummary({ date: DATE, timeZone: "America/Mexico_City", appointments: [instant] });
  assert.equal(mexico.appointments.today, 1);
  assert.equal(mexico.income.today, 10000);

  const bogota = buildDashboardSummary({ date: DATE, timeZone: BOGOTA, appointments: [instant] });
  assert.equal(bogota.appointments.today, 0);
});

test("topServices devuelve como máximo 5 ordenados por ingresos", () => {
  const appointments = [
    appointment("2026-11-05T10:00", { priceCOP: 10000, serviceName: "Servicio 1" }),
    appointment("2026-11-05T11:00", { priceCOP: 60000, serviceName: "Servicio 2" }),
    appointment("2026-11-05T12:00", { priceCOP: 30000, serviceName: "Servicio 3" }),
    appointment("2026-11-05T13:00", { priceCOP: 50000, serviceName: "Servicio 4" }),
    appointment("2026-11-05T14:00", { priceCOP: 20000, serviceName: "Servicio 5" }),
    appointment("2026-11-05T15:00", { priceCOP: 40000, serviceName: "Servicio 6" }),
  ];
  const summary = buildDashboardSummary({ date: DATE, timeZone: BOGOTA, appointments });
  assert.equal(summary.topServices.length, 5);
  assert.deepEqual(summary.topServices.map((service) => service.name), [
    "Servicio 2",
    "Servicio 4",
    "Servicio 6",
    "Servicio 3",
    "Servicio 5",
  ]);
  assert.equal(summary.topServices[0].income, 60000);
});

test("sin datos el resumen queda en ceros y nextMonthStart cruza el año", () => {
  const summary = buildDashboardSummary({ date: DATE, timeZone: BOGOTA });
  assert.deepEqual(summary.appointments, { today: 0, week: 0, month: 0, cancelled: 0 });
  assert.deepEqual(summary.income, { today: 0, week: 0, month: 0 });
  assert.deepEqual(summary.customers, { total: 0, newThisMonth: 0, newLast30Days: 0 });
  assert.deepEqual(summary.topServices, []);
  assert.equal(nextMonthStart("2026-12-01"), "2027-01-01");
  assert.equal(nextMonthStart("2026-11-01"), "2026-12-01");
});

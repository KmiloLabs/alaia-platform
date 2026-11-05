import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  formatLocalDateTime,
  isValidLocalDate,
  isValidLocalDateTime,
  isValidTimeZone,
  localDateRangeToUtc,
  localDayStartUtc,
  localToUtc,
  parseLocalDateTime,
  utcToLocalDateTime,
} from "../src/timezone.js";

test("convierte hora local de Bogotá a UTC", () => {
  const utc = localToUtc("2026-11-06T14:00", "America/Bogota");
  assert.equal(utc.toISOString(), "2026-11-06T19:00:00.000Z");
});

test("convierte UTC a hora local del negocio", () => {
  assert.equal(utcToLocalDateTime(new Date("2026-11-06T19:00:00.000Z"), "America/Bogota"), "2026-11-06T14:00");
});

test("respeta el horario de verano de Nueva York", () => {
  assert.equal(localToUtc("2026-07-01T09:00", "America/New_York").toISOString(), "2026-07-01T13:00:00.000Z");
  assert.equal(localToUtc("2026-01-15T09:00", "America/New_York").toISOString(), "2026-01-15T14:00:00.000Z");
});

test("respeta el horario de verano de Madrid", () => {
  assert.equal(localToUtc("2026-07-01T09:00", "Europe/Madrid").toISOString(), "2026-07-01T07:00:00.000Z");
  assert.equal(localToUtc("2026-01-15T09:00", "Europe/Madrid").toISOString(), "2026-01-15T08:00:00.000Z");
});

test("ida y vuelta local -> UTC -> local conserva la hora", () => {
  for (const timeZone of ["America/Bogota", "America/New_York", "Europe/Madrid", "Asia/Tokyo"]) {
    for (const local of ["2026-01-15T08:30", "2026-07-01T19:05", "2026-12-31T23:59"]) {
      const roundTrip = utcToLocalDateTime(localToUtc(local, timeZone), timeZone);
      assert.equal(roundTrip, local, `${timeZone} ${local}`);
    }
  }
});

test("hora ambigua por fin del horario de verano elige el instante anterior", () => {
  // 2026-11-01 01:30 ocurre dos veces en Nueva York: 05:30Z (EDT) y 06:30Z (EST).
  assert.equal(localToUtc("2026-11-01T01:30", "America/New_York").toISOString(), "2026-11-01T05:30:00.000Z");
});

test("el día con salto de horario de verano dura 23 horas", () => {
  const { start, end } = localDateRangeToUtc("2026-03-08", "2026-03-08", "America/New_York");
  assert.equal(start.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(end.toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 23 * 60 * 60 * 1000);
});

test("rango por fecha local de Bogotá", () => {
  const { start, end } = localDateRangeToUtc("2026-11-06", "2026-11-06", "America/Bogota");
  assert.equal(start.toISOString(), "2026-11-06T05:00:00.000Z");
  assert.equal(end.toISOString(), "2026-11-07T05:00:00.000Z");
});

test("rango de varios días incluye el último día completo", () => {
  const { start, end } = localDateRangeToUtc("2026-11-06", "2026-11-08", "America/Bogota");
  assert.equal(start.toISOString(), "2026-11-06T05:00:00.000Z");
  assert.equal(end.toISOString(), "2026-11-09T05:00:00.000Z");
});

test("inicio del día local", () => {
  assert.equal(localDayStartUtc("2026-11-06", "America/Bogota").toISOString(), "2026-11-06T05:00:00.000Z");
});

test("addDays cruza meses, años y años bisiestos", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
});

test("valida fechas locales reales", () => {
  assert.equal(isValidLocalDate("2026-11-06"), true);
  assert.equal(isValidLocalDate("2028-02-29"), true);
  assert.equal(isValidLocalDate("2026-02-29"), false);
  assert.equal(isValidLocalDate("2026-13-01"), false);
  assert.equal(isValidLocalDate("2026-11-6"), false);
  assert.equal(isValidLocalDate("06/11/2026"), false);
  assert.equal(isValidLocalDate(""), false);
  assert.equal(isValidLocalDate(null), false);
});

test("valida fechas y horas locales del formulario", () => {
  assert.equal(isValidLocalDateTime("2026-11-06T14:00"), true);
  assert.equal(isValidLocalDateTime("2026-11-06T14:00:30"), true);
  assert.equal(isValidLocalDateTime("2026-11-06T00:00"), true);
  assert.equal(isValidLocalDateTime("2026-11-06T24:00"), false);
  assert.equal(isValidLocalDateTime("2026-11-06T14:60"), false);
  assert.equal(isValidLocalDateTime("2026-11-06T14:00Z"), false);
  assert.equal(isValidLocalDateTime("2026-11-06 14:00"), false);
  assert.equal(isValidLocalDateTime("2026-11-06"), false);
  assert.equal(isValidLocalDateTime(1759766400000), false);
  assert.equal(isValidLocalDateTime(undefined), false);
});

test("parseLocalDateTime normaliza y rechaza valores imposibles", () => {
  assert.deepEqual(parseLocalDateTime("2026-11-06T14:00"), {
    year: 2026,
    month: 11,
    day: 6,
    hour: 14,
    minute: 0,
    second: 0,
  });
  assert.equal(parseLocalDateTime("2026-02-30T10:00"), null);
  assert.equal(formatLocalDateTime(parseLocalDateTime("2026-11-06T09:05:59")), "2026-11-06T09:05");
});

test("valida zonas horarias IANA", () => {
  assert.equal(isValidTimeZone("America/Bogota"), true);
  assert.equal(isValidTimeZone("Europe/Madrid"), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Foo/Bar"), false);
  assert.equal(isValidTimeZone(""), false);
  assert.equal(isValidTimeZone(null), false);
});

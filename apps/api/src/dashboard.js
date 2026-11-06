// Resumen (dashboard) del negocio: cálculo puro con citas y clientes ya
// acotados por el servicio. La semana es lunes-domingo en la zona del negocio.

import { businessDayNumber } from "./availability.js";
import { isActiveAppointmentStatus } from "./appointment-status.js";
import {
  addDays,
  isValidLocalDate,
  isValidTimeZone,
  localDateRangeToUtc,
  utcToLocalDate,
} from "./timezone.js";

export const FALLBACK_TIME_ZONE = "America/Bogota";
export const MAX_TOP_SERVICES = 5;

// `date` opcional: por defecto hoy en la zona del negocio.
export function resolveDashboardDate({ date, timeZone, now = new Date() } = {}) {
  const timeZoneResolved = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  if (date === undefined || date === null || date === "") {
    return { ok: true, value: { date: utcToLocalDate(now, timeZoneResolved), timeZone: timeZoneResolved } };
  }
  if (typeof date !== "string" || !isValidLocalDate(date.trim())) {
    return { ok: false, status: 400, code: "invalid_date", message: "La fecha debe tener formato AAAA-MM-DD." };
  }
  return { ok: true, value: { date: date.trim(), timeZone: timeZoneResolved } };
}

// Rangos [inicio, fin) en UTC para hoy, la semana (lunes-domingo), el mes y los
// últimos 30 días. `query` es la unión de mes y semana: acota las consultas sin
// leer la colección entera y cubre la semana cuando cruza de mes.
export function getDashboardRanges(date, timeZone) {
  const dayNumber = businessDayNumber(date);
  const weekStartDate = addDays(date, -(dayNumber - 1));
  const weekEndDate = addDays(weekStartDate, 7);
  const weekLastDate = addDays(weekEndDate, -1);

  const monthStartDate = `${date.slice(0, 7)}-01`;
  const monthEndDate = nextMonthStart(monthStartDate);
  const monthLastDate = addDays(monthEndDate, -1);

  const last30StartDate = addDays(date, -29);

  const queryFromDate = weekStartDate < monthStartDate ? weekStartDate : monthStartDate;
  const queryLastDate = weekLastDate > monthLastDate ? weekLastDate : monthLastDate;

  return {
    date,
    weekStartDate,
    weekEndDate,
    monthStartDate,
    monthEndDate,
    today: localDateRangeToUtc(date, date, timeZone),
    week: localDateRangeToUtc(weekStartDate, weekLastDate, timeZone),
    month: localDateRangeToUtc(monthStartDate, monthLastDate, timeZone),
    last30: localDateRangeToUtc(last30StartDate, date, timeZone),
    query: localDateRangeToUtc(queryFromDate, queryLastDate, timeZone),
  };
}

export function buildDashboardSummary({ date, timeZone, appointments = [], customers = {} } = {}) {
  const ranges = getDashboardRanges(date, timeZone);
  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  let cancelledCount = 0;
  let incomeToday = 0;
  let incomeWeek = 0;
  let incomeMonth = 0;
  const serviceTotals = new Map();

  for (const appointment of Array.isArray(appointments) ? appointments : []) {
    const startsAtMs = toMillis(appointment?.startsAt);
    if (startsAtMs === null) continue;

    if (appointment?.status === "cancelled") {
      if (inRange(startsAtMs, ranges.month)) cancelledCount += 1;
      continue;
    }
    // Ingresos y conteos: scheduled + completed. no_show (y otros) no suman.
    if (!isActiveAppointmentStatus(appointment?.status ?? "scheduled")) continue;

    const price = Number.isInteger(appointment?.priceCOP) ? appointment.priceCOP : 0;
    const isToday = inRange(startsAtMs, ranges.today);
    const isWeek = inRange(startsAtMs, ranges.week);
    const isMonth = inRange(startsAtMs, ranges.month);

    if (isToday) {
      todayCount += 1;
      incomeToday += price;
    }
    if (isWeek) {
      weekCount += 1;
      incomeWeek += price;
    }
    if (isMonth) {
      monthCount += 1;
      incomeMonth += price;
      const name = typeof appointment?.serviceName === "string" && appointment.serviceName.trim() !== ""
        ? appointment.serviceName.trim()
        : "(sin servicio)";
      const entry = serviceTotals.get(name) ?? { name, count: 0, income: 0 };
      entry.count += 1;
      entry.income += price;
      serviceTotals.set(name, entry);
    }
  }

  const topServices = [...serviceTotals.values()]
    .sort((a, b) => b.income - a.income || b.count - a.count || a.name.localeCompare(b.name, "es"))
    .slice(0, MAX_TOP_SERVICES);

  return {
    date,
    timeZone,
    appointments: { today: todayCount, week: weekCount, month: monthCount, cancelled: cancelledCount },
    income: { today: incomeToday, week: incomeWeek, month: incomeMonth },
    customers: {
      total: integerOrZero(customers?.total),
      newThisMonth: integerOrZero(customers?.newThisMonth),
      newLast30Days: integerOrZero(customers?.newLast30Days),
    },
    topServices,
  };
}

export function nextMonthStart(monthStartDate) {
  const year = Number(monthStartDate.slice(0, 4));
  const month = Number(monthStartDate.slice(5, 7));
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function inRange(millis, range) {
  return millis >= range.start.getTime() && millis < range.end.getTime();
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().getTime();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function integerOrZero(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

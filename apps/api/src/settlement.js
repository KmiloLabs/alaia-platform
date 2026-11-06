// Liquidación de comisiones (vista previa): cálculo puro a partir de las citas
// scheduled del rango y la configuración de comisión de cada profesional.

import { isValidLocalDate, isValidTimeZone, localDateRangeToUtc } from "./timezone.js";

export const MAX_SETTLEMENT_DAYS = 92;
const FALLBACK_TIME_ZONE = "America/Bogota";

export function validateSettlementRange(query) {
  const from = typeof query?.from === "string" ? query.from.trim() : "";
  const to = typeof query?.to === "string" ? query.to.trim() : "";
  if (!isValidLocalDate(from) || !isValidLocalDate(to)) {
    return invalid("invalid_date", "Indica from y to con formato AAAA-MM-DD.");
  }
  if (from > to) return invalid("invalid_range", "La fecha inicial no puede ser posterior a la final.");
  if (daysBetween(from, to) > MAX_SETTLEMENT_DAYS) {
    return invalid("invalid_range", `El rango no puede superar ${MAX_SETTLEMENT_DAYS} días.`);
  }
  return { ok: true, value: { from, to } };
}

export function buildSettlementPreview({ from, to, timeZone, appointments = [], professionals = [] } = {}) {
  const tz = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  const range = localDateRangeToUtc(from, to, tz);
  const professionalById = new Map(
    (Array.isArray(professionals) ? professionals : []).map((professional) => [professional.professionalId, professional]),
  );

  let businessServices = 0;
  let businessGross = 0;
  let unassignedServices = 0;
  let unassignedGross = 0;
  const groups = new Map();

  for (const appointment of Array.isArray(appointments) ? appointments : []) {
    if (appointment?.status !== "scheduled") continue;
    const startsAtMs = toMillis(appointment?.startsAt);
    if (startsAtMs === null || startsAtMs < range.start.getTime() || startsAtMs >= range.end.getTime()) continue;

    const price = Number.isInteger(appointment?.priceCOP) ? appointment.priceCOP : 0;
    businessServices += 1;
    businessGross += price;

    const professionalId = normalizeProfessionalId(appointment?.professionalId);
    if (professionalId === null) {
      unassignedServices += 1;
      unassignedGross += price;
      continue;
    }

    const group = groups.get(professionalId) ?? {
      professionalId,
      services: 0,
      gross: 0,
      nameSnapshot: typeof appointment?.professionalName === "string" ? appointment.professionalName : null,
    };
    group.services += 1;
    group.gross += price;
    groups.set(professionalId, group);
  }

  const daysInRange = daysBetween(from, to) + 1;
  const daysInMonthOfTo = daysInMonth(to);

  const breakdown = [...groups.values()]
    .map((group) => {
      const professional = professionalById.get(group.professionalId) ?? null;
      const config = professional?.commission ?? null;
      const { commission, rent } = computeCommission({
        config,
        gross: group.gross,
        services: group.services,
        daysInRange,
        daysInMonth: daysInMonthOfTo,
      });
      return {
        professionalId: group.professionalId,
        name: professional?.name ?? group.nameSnapshot ?? "",
        services: group.services,
        gross: group.gross,
        commission,
        rent,
        net: commission - rent,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    from,
    to,
    timeZone: tz,
    business: { services: businessServices, gross: businessGross },
    professionals: breakdown,
    unassigned: { services: unassignedServices, gross: unassignedGross },
  };
}

export function computeCommission({ config, gross = 0, services = 0, daysInRange, daysInMonth }) {
  const type = config?.type;
  const percent = integerOrZero(config?.percent);
  const amountCOP = integerOrZero(config?.amountCOP);
  const rentCOP = integerOrZero(config?.rentCOP);
  const proratedRent = daysInMonth > 0
    ? Math.round((rentCOP * daysInRange) / daysInMonth)
    : 0;

  if (type === "percentage") {
    return { commission: Math.round((gross * percent) / 100), rent: 0 };
  }
  if (type === "fixed") {
    return { commission: amountCOP * services, rent: 0 };
  }
  if (type === "rent") {
    return { commission: 0, rent: proratedRent };
  }
  if (type === "mixed") {
    return { commission: Math.round((gross * percent) / 100), rent: proratedRent };
  }
  return { commission: 0, rent: 0 };
}

export function daysInMonth(dateString) {
  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function daysBetween(from, to) {
  return Math.round((localDateToUtcMs(to) - localDateToUtcMs(from)) / 86_400_000);
}

function localDateToUtcMs(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function normalizeProfessionalId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function integerOrZero(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
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

function invalid(code, message) {
  return { ok: false, status: 400, code, message };
}

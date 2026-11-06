// Conversión de hora local del negocio <-> UTC usando solo Intl (sin librerías).
// La agenda guarda instantes UTC y el texto local original; este módulo concentra
// esas conversiones para que las rutas y las pruebas usen la misma regla.

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const formatterCache = new Map();
const pad = (value) => String(value).padStart(2, "0");

function getFormatter(timeZone) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function zonedParts(date, timeZone) {
  const parts = {};
  for (const part of getFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

// Desfase (local - UTC) en milisegundos para un instante concreto.
function timeZoneOffsetMs(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function isValidLocalDate(value) {
  if (typeof value !== "string") return false;
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidLocalDateTime(value) {
  return parseLocalDateTime(value) !== null;
}

export function parseLocalDateTime(value) {
  if (typeof value !== "string") return null;
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  if (!isValidLocalDate(`${yearText}-${monthText}-${dayText}`)) return null;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour,
    minute,
    second,
  };
}

export function formatLocalDateTime(parts) {
  return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function addDays(dateString, days) {
  const match = LOCAL_DATE_PATTERN.exec(dateString);
  if (!match) throw new RangeError("invalid_local_date");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// Hora local del negocio -> instante UTC. Si la hora no existe por un salto de
// horario de verano se ajusta con el desfase posterior; si es ambigua se elige
// el instante anterior (convención habitual para citas).
export function localToUtc(localDateTime, timeZone) {
  const parts = parseLocalDateTime(localDateTime);
  if (!parts) throw new RangeError("invalid_local_datetime");
  const naiveMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const firstOffset = timeZoneOffsetMs(new Date(naiveMs), timeZone);
  const candidate = naiveMs - firstOffset;
  const secondOffset = timeZoneOffsetMs(new Date(candidate), timeZone);
  return new Date(naiveMs - secondOffset);
}

export function utcToLocalDateTime(date, timeZone) {
  return formatLocalDateTime(zonedParts(date, timeZone));
}

export function utcToLocalDate(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function localDayStartUtc(dateString, timeZone) {
  if (!isValidLocalDate(dateString)) throw new RangeError("invalid_local_date");
  return localToUtc(`${dateString}T00:00`, timeZone);
}

// Rango [inicio del día `from`, inicio del día siguiente a `to`) en UTC.
export function localDateRangeToUtc(fromDate, toDate, timeZone) {
  if (!isValidLocalDate(fromDate) || !isValidLocalDate(toDate)) throw new RangeError("invalid_local_date");
  return {
    start: localDayStartUtc(fromDate, timeZone),
    end: localDayStartUtc(addDays(toDate, 1), timeZone),
  };
}

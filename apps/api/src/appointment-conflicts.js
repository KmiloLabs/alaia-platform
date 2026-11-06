// Reglas puras de conflicto y ocupación de agenda por profesional.
// `professionalId: null` representa el cupo compartido "sin asignar":
// - dos citas sin asignar se cruzan entre sí;
// - una cita asignada y una sin asignar NO se cruzan;
// - dos citas del mismo profesional sí se cruzan.

export function normalizeProfessionalId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function sameProfessionalSlot(a, b) {
  return normalizeProfessionalId(a) === normalizeProfessionalId(b);
}

export function isOverlapping(startsAtMs, endsAtMs, otherStartMs, otherEndMs) {
  return otherStartMs < endsAtMs && otherEndMs > startsAtMs;
}

// Devuelve la primera cita en conflicto (o null). Acepta snapshots de Firestore
// o dobles { id, data }.
export function findAppointmentConflict(docs, {
  startsAtMs,
  endsAtMs,
  professionalId = null,
  ignoreAppointmentId = null,
} = {}) {
  const targetProfessionalId = normalizeProfessionalId(professionalId);

  for (const doc of Array.isArray(docs) ? docs : []) {
    if (ignoreAppointmentId && doc?.id === ignoreAppointmentId) continue;
    const data = typeof doc?.data === "function" ? doc.data() : doc?.data ?? {};
    if (data.status !== "scheduled") continue;

    const otherStart = toMillis(data.startsAt);
    const otherEnd = toMillis(data.endsAt);
    if (otherStart === null || otherEnd === null) continue;
    if (!isOverlapping(startsAtMs, endsAtMs, otherStart, otherEnd)) continue;
    if (!sameProfessionalSlot(targetProfessionalId, data.professionalId)) continue;
    return { doc, data };
  }

  return null;
}

// ¿Esta cita bloquea la disponibilidad pedida?
// - Sin filtro (professionalId null): cualquier cita scheduled ocupa el hueco.
// - Con filtro: bloquea la del propio profesional y la que no tiene asignado.
export function blocksAvailability(appointmentData, professionalId = null) {
  if (appointmentData?.status !== "scheduled") return false;
  const requested = normalizeProfessionalId(professionalId);
  if (requested === null) return true;
  return sameProfessionalSlot(appointmentData?.professionalId, null)
    || sameProfessionalSlot(appointmentData?.professionalId, requested);
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

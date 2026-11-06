// Estados de cita y reglas de transición/permisos. Puro y probado con dobles.

export const APPOINTMENT_STATUSES = Object.freeze(["scheduled", "completed", "no_show", "cancelled"]);
export const ACTIVE_APPOINTMENT_STATUSES = Object.freeze(["scheduled", "completed"]);
export const UPDATABLE_APPOINTMENT_STATUSES = Object.freeze(["scheduled", "completed", "no_show"]);

const ACTIVE_SET = new Set(ACTIVE_APPOINTMENT_STATUSES);

// Ocupa agenda, suma ingresos y liquidación.
export function isActiveAppointmentStatus(status) {
  return ACTIVE_SET.has(status);
}

// La transición de estado solo admite estos valores por la ruta /status.
export function validateAppointmentStatusUpdate(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const status = input.status;
  if (!UPDATABLE_APPOINTMENT_STATUSES.includes(status)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_status",
      message: "El estado debe ser scheduled, completed o no_show.",
    };
  }
  return { ok: true, value: { status } };
}

// Dueño/admin pueden cambiar cualquier cita; un profesional solo la suya asignada.
export function canUpdateAppointmentStatus({ role, professionalId = null, appointmentProfessionalId = null }) {
  if (role === "owner" || role === "admin") return true;
  if (role !== "professional") return false;
  if (typeof professionalId !== "string" || professionalId === "") return false;
  return appointmentProfessionalId === professionalId;
}

import { auth } from "./firebase.js";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const ERROR_MESSAGES = {
  unauthenticated: "Tu sesión ya no es válida. Vuelve a iniciar sesión.",
  origin_not_allowed: "El panel no tiene permiso para hablar con la API (origen no permitido).",
  tenant_not_found: "No encontramos ese negocio o tu cuenta no tiene acceso. Elige otro negocio.",
  tenant_unavailable: "El acceso a este negocio está pausado. Elige otro negocio.",
  tenant_name_taken: "Ya existe un negocio con ese nombre. Prueba una variante.",
  invalid_tenant: "El negocio indicado no es válido.",
  invalid_name: "El nombre debe tener entre 2 y 80 caracteres.",
  invalid_service: "El servicio debe tener entre 2 y 80 caracteres.",
  invalid_start: "La fecha y la hora de la cita no son válidas.",
  invalid_duration: "La duración debe estar entre 5 y 480 minutos.",
  invalid_price: "El precio debe ser un entero entre 0 y 10.000.000 COP.",
  invalid_range: "El rango de fechas no es válido.",
  invalid_sector: "Selecciona un tipo de negocio válido.",
  invalid_timezone: "La zona horaria no es válida.",
  appointment_conflict: "Ese horario se cruza con otra cita del negocio. Elige otra hora.",
  appointment_not_found: "No encontramos esa cita en este negocio. Recarga la agenda.",
  tenant_lookup_failed: "No pudimos comprobar el acceso al negocio. Intenta de nuevo.",
  internal_error: "Ocurrió un error en el servidor. Intenta de nuevo.",
  network_error: `No pudimos conectar con la API (${API_BASE}). Revisa que el servidor esté activo.`,
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isUnauthorized(error) {
  return error instanceof ApiError && (error.status === 401 || error.code === "unauthenticated");
}

export function isTenantAccessError(error) {
  return error instanceof ApiError && (
    error.status === 403 ||
    error.status === 404 ||
    error.code === "tenant_not_found" ||
    error.code === "tenant_unavailable"
  );
}

export function isConflict(error) {
  return error instanceof ApiError && (error.status === 409 || error.code === "appointment_conflict");
}

/** Mensaje en español para mostrar al dueño del negocio. */
export function messageForError(error) {
  if (error instanceof ApiError) return ERROR_MESSAGES[error.code] ?? error.message;
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}

/** Identificador único por intento de creación; la API no duplica con el mismo valor. */
export function createClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `alaia-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request(path, { method = "GET", body } = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError(401, "unauthenticated", "Inicia sesión para continuar.");
  }

  let token;
  try {
    token = await user.getIdToken();
  } catch {
    throw new ApiError(401, "unauthenticated", "La sesión no es válida o ha vencido.");
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network_error", `No pudimos conectar con ${API_BASE}.`);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const code = payload?.error?.code ?? `http_${response.status}`;
    const message = payload?.error?.message ?? `La API respondió ${response.status}.`;
    throw new ApiError(response.status, code, message);
  }

  return payload;
}

export function listTenants() {
  return request("/api/v1/me/tenants");
}

export function createTenant({ name, sector, timeZone }) {
  return request("/api/v1/tenants", {
    method: "POST",
    body: { name, sector, timeZone },
  });
}

export function getTenantContext(tenantId) {
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/context`);
}

export function listAppointments(tenantId, { from, to }) {
  const params = new URLSearchParams({ from, to });
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/appointments?${params.toString()}`);
}

export function createAppointment(tenantId, appointment) {
  const body = {
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone ?? null,
    serviceName: appointment.serviceName,
    startsAt: appointment.startsAt,
    durationMinutes: appointment.durationMinutes,
    priceCOP: appointment.priceCOP,
    notes: appointment.notes ?? "",
    clientRequestId: appointment.clientRequestId ?? createClientRequestId(),
  };
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/appointments`, {
    method: "POST",
    body,
  });
}

export function cancelAppointment(tenantId, appointmentId) {
  return request(
    `/api/v1/tenants/${encodeURIComponent(tenantId)}/appointments/${encodeURIComponent(appointmentId)}/cancel`,
    { method: "POST" },
  );
}

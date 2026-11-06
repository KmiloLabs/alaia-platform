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
  invalid_step: "El intervalo entre horarios no es válido.",
  invalid_hours: "Revisa el horario: cada día abierto necesita una apertura anterior al cierre.",
  invalid_slot_step: "El intervalo entre citas debe ser un número entre 5 y 240 minutos.",
  empty_update: "No hay cambios para guardar.",
  not_owner: "Solo el propietario del negocio puede cambiar esta configuración.",
  invalid_service_name: "El nombre del servicio debe tener entre 2 y 80 caracteres.",
  invalid_service_description: "La descripción no puede superar los 300 caracteres.",
  invalid_service_category: "La categoría no puede superar los 40 caracteres.",
  service_name_taken: "Ya existe un servicio con ese nombre en tu negocio.",
  service_not_found: "No encontramos ese servicio en tu negocio.",
  invalid_customer_name: "El nombre del cliente debe tener entre 2 y 80 caracteres.",
  invalid_customer_phone: "El teléfono debe tener entre 7 y 15 dígitos.",
  invalid_customer_email: "El correo del cliente no es válido.",
  invalid_customer_notes: "Las notas del cliente no pueden superar los 300 caracteres.",
  customer_phone_taken: "Ese teléfono ya está registrado en otro cliente de tu negocio.",
  customer_not_found: "No encontramos ese cliente en tu negocio.",
  not_platform_admin: "Tu cuenta no tiene acceso al panel de plataforma de ALAIA.",
  tenant_suspended: "Tu cuenta está suspendida. Contacta a ALAIA.",
  invalid_status: "El estado indicado no es válido.",
  invalid_plan: "El plan indicado no es válido.",
  invalid_notes: "Las notas no pueden superar los 300 caracteres.",
  invalid_description: "La descripción no puede superar los 300 caracteres.",
  invalid_address: "La dirección no puede superar los 200 caracteres.",
  invalid_phone: "El teléfono del negocio no es válido.",
  invalid_social_link: "Revisa las redes: usa https:// o un número de WhatsApp válido.",
  provider_not_found: "No encontramos ese proveedor de IA.",
  invalid_api_key: "La clave debe tener entre 8 y 200 caracteres.",
  invalid_models: "Escribe entre 1 y 10 modelos, separados por comas (máx. 64 caracteres cada uno).",
  invalid_model: "El modelo por defecto debe estar dentro de la lista.",
  invalid_enabled: "El estado del proveedor no es válido.",
  provider_test_failed: "No se pudo conectar con el proveedor. Revisa la clave y los modelos.",
  platform_secret_missing: "Falta PLATFORM_SECRET en el servidor para cifrar claves.",
  invalid_sector: "Selecciona un tipo de negocio válido.",
  invalid_timezone: "La zona horaria no es válida.",
  appointment_conflict: "Ese horario se cruza con otra cita del negocio. Elige otra hora.",
  appointment_not_found: "No encontramos esa cita en este negocio. Recarga la agenda.",
  appointment_cancelled: "Esa cita ya está cancelada; no se puede reprogramar. Actualiza la agenda.",
  invalid_provider: "Ese proveedor no está disponible. Elige uno de los que ya están configurados.",
  invalid_model: "Ese modelo no pertenece al proveedor elegido.",
  invalid_instructions: "Las instrucciones deben tener 500 caracteres como máximo.",
  invalid_tone: "Elige un tono válido: cercano, formal o directo.",
  invalid_message: "Escribe un mensaje de prueba antes de enviarlo.",
  agent_not_configured: "El agente no tiene proveedor configurado en el servidor. Añade la clave del proveedor en el archivo .env o activa AGENT_ENABLE_MOCK=true para probar.",
  agent_provider_error: "El proveedor de IA no respondió correctamente. Intenta de nuevo en unos minutos.",
  conversation_not_found: "La conversación anterior ya no está disponible. Empezamos una conversación nueva.",
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
    if (code === "tenant_suspended" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("alaia:tenant-suspended", { detail: { message } }));
    }
    throw new ApiError(response.status, code, message);
  }

  return payload;
}

export function listTenants() {
  return request("/api/v1/me/tenants");
}

export function getMe() {
  return request("/api/v1/me");
}

export function getPlatformSummary() {
  return request("/api/v1/platform/summary");
}

export function listPlatformTenants({ query = "", status = "" } = {}) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (status) params.set("status", status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/v1/platform/tenants${suffix}`);
}

export function getPlatformTenant(tenantId) {
  return request(`/api/v1/platform/tenants/${encodeURIComponent(tenantId)}`);
}

export function updatePlatformTenant(tenantId, changes) {
  return request(`/api/v1/platform/tenants/${encodeURIComponent(tenantId)}`, {
    method: "PATCH",
    body: changes,
  });
}

export function listPlatformProviders() {
  return request("/api/v1/platform/providers");
}

export function updatePlatformProvider(provider, changes) {
  return request(`/api/v1/platform/providers/${encodeURIComponent(provider)}`, {
    method: "PUT",
    body: changes,
  });
}

export function deletePlatformProvider(provider) {
  return request(`/api/v1/platform/providers/${encodeURIComponent(provider)}`, {
    method: "DELETE",
  });
}

export function testPlatformProvider(provider) {
  return request(`/api/v1/platform/providers/${encodeURIComponent(provider)}/test`, {
    method: "POST",
  });
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

export function getDashboard(tenantId, date) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/dashboard${suffix}`);
}

export function updateTenant(tenantId, changes) {
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}`, {
    method: "PATCH",
    body: changes,
  });
}

export function listServices(tenantId, { includeInactive = false } = {}) {
  const query = includeInactive ? "?includeInactive=1" : "";
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/services${query}`);
}

export function createService(tenantId, service) {
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/services`, {
    method: "POST",
    body: {
      name: service.name,
      description: service.description ?? "",
      category: service.category ?? "",
      durationMinutes: service.durationMinutes,
      priceCOP: service.priceCOP,
    },
  });
}

export function updateService(tenantId, serviceId, changes) {
  return request(
    `/api/v1/tenants/${encodeURIComponent(tenantId)}/services/${encodeURIComponent(serviceId)}`,
    { method: "PATCH", body: changes },
  );
}

export function deactivateService(tenantId, serviceId) {
  return request(
    `/api/v1/tenants/${encodeURIComponent(tenantId)}/services/${encodeURIComponent(serviceId)}`,
    { method: "DELETE" },
  );
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
  if (appointment.customerId) body.customerId = appointment.customerId;
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/appointments`, {
    method: "POST",
    body,
  });
}

export function listCustomers(tenantId, { query = "", includeInactive = false } = {}) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (includeInactive) params.set("includeInactive", "1");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/customers${suffix}`);
}

export function getCustomer(tenantId, customerId) {
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/customers/${encodeURIComponent(customerId)}`);
}

export function createCustomer(tenantId, customer) {
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/customers`, {
    method: "POST",
    body: {
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      notes: customer.notes ?? "",
    },
  });
}

export function updateCustomer(tenantId, customerId, changes) {
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/customers/${encodeURIComponent(customerId)}`, {
    method: "PATCH",
    body: changes,
  });
}

export function deactivateCustomer(tenantId, customerId) {
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/customers/${encodeURIComponent(customerId)}`, {
    method: "DELETE",
  });
}

export function cancelAppointment(tenantId, appointmentId) {
  return request(
    `/api/v1/tenants/${encodeURIComponent(tenantId)}/appointments/${encodeURIComponent(appointmentId)}/cancel`,
    { method: "POST" },
  );
}

export function listAvailability(tenantId, { from, to, durationMinutes, stepMinutes }) {
  const params = new URLSearchParams({ from, to, durationMinutes: String(durationMinutes) });
  if (stepMinutes) params.set("stepMinutes", String(stepMinutes));
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/availability?${params.toString()}`);
}

export function rescheduleAppointment(tenantId, appointmentId, { startsAt, durationMinutes }) {
  const body = { startsAt };
  if (durationMinutes !== undefined && durationMinutes !== null) {
    body.durationMinutes = durationMinutes;
  }
  return request(
    `/api/v1/tenants/${encodeURIComponent(tenantId)}/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
    { method: "POST", body },
  );
}

export function getAgentConfig(tenantId) {
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/agent/config`);
}

export function saveAgentConfig(tenantId, config) {
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/agent/config`, {
    method: "PUT",
    body: {
      provider: config.provider,
      model: config.model,
      tone: config.tone,
      instructions: config.instructions ?? "",
    },
  });
}

export function sendAgentMessage(tenantId, { message, conversationId }) {
  const body = { message };
  if (conversationId) body.conversationId = conversationId;
  return request(`/api/v1/tenants/${encodeURIComponent(tenantId)}/agent/messages`, {
    method: "POST",
    body,
  });
}

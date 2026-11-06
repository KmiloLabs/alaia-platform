#!/usr/bin/env node
/**
 * Verificación end-to-end del corte "panel real con citas guardadas".
 *
 * Requiere (en terminales separadas):
 *   1) npm run emulators   (Auth 9099 · Firestore 8081)
 *   2) npm run dev:api     (API 3001)
 *
 * Uso: npm run verify
 * Variables opcionales: API_BASE, AUTH_EMULATOR
 *
 * Crea usuarios, negocios y citas FICTICIOS. No usa datos reales.
 */

const API_BASE = process.env.API_BASE || "http://localhost:3001";
const AUTH_EMULATOR = process.env.AUTH_EMULATOR || "http://127.0.0.1:9099";
const RUN_ID = Date.now().toString(36);
const DATE = "2030-03-15";

const results = [];

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  const mark = passed ? "PASA" : "FALLA";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function section(title) {
  console.log(`\n${title}`);
}

async function http(url, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* cuerpo no JSON */ }
  return { status: response.status, json, text };
}

const api = (path, options) => http(`${API_BASE}${path}`, options);

async function signUp(label) {
  const email = `verify-${label}-${RUN_ID}@alaia.test`;
  const { status, json } = await http(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    { method: "POST", body: { email, password: "Secreta123!", returnSecureToken: true } },
  );
  if (status !== 200 || !json?.idToken) {
    throw new Error(`No se pudo crear el usuario de prueba ${label}: ${status} ${JSON.stringify(json)}`);
  }
  return { email, idToken: json.idToken, uid: json.localId };
}

async function createTenant(user, label) {
  const { status, json } = await api("/api/v1/tenants", {
    method: "POST",
    token: user.idToken,
    body: { name: `Verificación ${label} ${RUN_ID}`, sector: "barberia", timeZone: "America/Bogota" },
  });
  if (status !== 201 || !json?.tenant?.tenantId) {
    throw new Error(`No se pudo crear el negocio ${label}: ${status} ${JSON.stringify(json)}`);
  }
  return json.tenant;
}

function appointmentBody(overrides = {}) {
  return {
    customerName: "Cliente Ficticio",
    serviceName: "Corte clásico",
    startsAt: `${DATE}T10:00`,
    durationMinutes: 45,
    priceCOP: 50000,
    ...overrides,
  };
}

async function main() {
  console.log(`Verificación Alaia · API ${API_BASE} · Auth ${AUTH_EMULATOR}`);

  section("0. Servicios disponibles");
  const health = await api("/health");
  check("La API responde /health", health.status === 200, `HTTP ${health.status}`);
  if (health.status !== 200) {
    console.error("\nLa API no está arriba. Ejecuta antes: npm run emulators y npm run dev:api");
    process.exit(1);
  }

  section("1. Cuentas y negocios");
  const userA = await signUp("a");
  const userB = await signUp("b");
  check("Se crean dos cuentas de prueba", Boolean(userA.idToken && userB.idToken));
  const tenantA = await createTenant(userA, "A");
  const tenantB = await createTenant(userB, "B");
  check("Cada cuenta crea su negocio", Boolean(tenantA.tenantId && tenantB.tenantId));

  const mine = await api("/api/v1/me/tenants", { token: userA.idToken });
  const myIds = (mine.json?.tenants ?? []).map((tenant) => tenant.tenantId);
  check("A solo ve sus propios negocios", mine.status === 200 && myIds.includes(tenantA.tenantId) && !myIds.includes(tenantB.tenantId), `HTTP ${mine.status}`);

  section("2. Citas reales del negocio A");
  const created = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: appointmentBody({ clientRequestId: `req-${RUN_ID}-1` }),
  });
  const appointment = created.json?.appointment;
  check("A crea una cita", created.status === 201 && Boolean(appointment?.appointmentId), `HTTP ${created.status}`);
  check("La cita conserva la hora local del negocio", appointment?.startsAtLocal === `${DATE}T10:00`, `startsAtLocal=${appointment?.startsAtLocal}`);
  check("La cita se guarda en UTC (15:00Z para Bogotá UTC-5)", String(appointment?.startsAt ?? "").includes("T15:00:00"), `startsAt=${appointment?.startsAt}`);

  const listed = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=${DATE}&to=${DATE}`, { token: userA.idToken });
  const listedIds = (listed.json?.appointments ?? []).map((item) => item.appointmentId);
  check("A lista la cita del día", listed.status === 200 && listedIds.length === 1 && listedIds[0] === appointment?.appointmentId, `HTTP ${listed.status}`);

  const otherDay = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=2030-03-16&to=2030-03-17`, { token: userA.idToken });
  check("Un rango sin citas devuelve lista vacía", otherDay.status === 200 && (otherDay.json?.appointments ?? []).length === 0, `HTTP ${otherDay.status}`);

  section("3. Aislamiento entre negocios");
  const crossRead = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=${DATE}&to=${DATE}`, { token: userB.idToken });
  check("B no puede leer la agenda de A", [403, 404].includes(crossRead.status), `HTTP ${crossRead.status}`);

  const crossWrite = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userB.idToken, body: appointmentBody({ startsAt: `${DATE}T16:00` }),
  });
  check("B no puede escribir citas en A", [403, 404].includes(crossWrite.status), `HTTP ${crossWrite.status}`);

  const afterCross = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=${DATE}&to=${DATE}`, { token: userA.idToken });
  check("El intento cruzado no dejó basura en A", (afterCross.json?.appointments ?? []).length === 1, `${(afterCross.json?.appointments ?? []).length} cita(s)`);

  const crossReadB = await api(`/api/v1/tenants/${tenantB.tenantId}/appointments?from=${DATE}&to=${DATE}`, { token: userA.idToken });
  check("A no puede leer la agenda de B", [403, 404].includes(crossReadB.status), `HTTP ${crossReadB.status}`);

  section("4. No doble reserva");
  const overlap = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken, body: appointmentBody({ startsAt: `${DATE}T10:30` }),
  });
  check("Una cita solapada se rechaza con 409", overlap.status === 409 && overlap.json?.error?.code === "appointment_conflict", `HTTP ${overlap.status} ${overlap.json?.error?.code ?? ""}`);

  const beforeCancel = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken, body: appointmentBody({ startsAt: `${DATE}T12:00` }),
  });
  check("Una cita contigua (sin solape) sí se acepta", beforeCancel.status === 201, `HTTP ${beforeCancel.status}`);

  section("5. Idempotencia");
  const repeated = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken, body: appointmentBody({ clientRequestId: `req-${RUN_ID}-1` }),
  });
  check("Repetir clientRequestId no duplica", [200, 201].includes(repeated.status) && repeated.json?.appointment?.appointmentId === appointment?.appointmentId, `HTTP ${repeated.status}`);
  const countAfterRepeat = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=${DATE}&to=${DATE}`, { token: userA.idToken });
  check("Sigue habiendo 2 citas, no 3", (countAfterRepeat.json?.appointments ?? []).length === 2, `${(countAfterRepeat.json?.appointments ?? []).length} cita(s)`);

  section("6. Cancelación libera el horario");
  const cancelled = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/${appointment.appointmentId}/cancel`, {
    method: "POST", token: userA.idToken,
  });
  check("A cancela su cita", cancelled.status === 200 && cancelled.json?.appointment?.status === "cancelled", `HTTP ${cancelled.status}`);
  const cancelAgain = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/${appointment.appointmentId}/cancel`, {
    method: "POST", token: userA.idToken,
  });
  check("Cancelar dos veces es idempotente", cancelAgain.status === 200, `HTTP ${cancelAgain.status}`);

  const freedSlot = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken, body: appointmentBody({ startsAt: `${DATE}T10:30` }),
  });
  check("El horario liberado se puede volver a reservar", freedSlot.status === 201, `HTTP ${freedSlot.status}`);

  section("7. Validaciones y errores");
  const noToken = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=${DATE}&to=${DATE}`);
  check("Sin token responde 401", noToken.status === 401, `HTTP ${noToken.status}`);

  const badPrice = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken, body: appointmentBody({ startsAt: `${DATE}T20:00`, priceCOP: -1 }),
  });
  check("Precio inválido responde 400", badPrice.status === 400, `HTTP ${badPrice.status}`);

  const badDate = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken, body: appointmentBody({ startsAt: "no-es-fecha" }),
  });
  check("Fecha inválida responde 400", badDate.status === 400, `HTTP ${badDate.status}`);

  const badRange = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=2030-03-20&to=2030-03-10`, { token: userA.idToken });
  check("Rango invertido responde 400", badRange.status === 400, `HTTP ${badRange.status}`);

  section("8. Persistencia");
  const finalList = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=${DATE}&to=${DATE}`, { token: userA.idToken });
  const finalItems = finalList.json?.appointments ?? [];
  check("Las citas siguen ahí tras varias llamadas", finalItems.length === 3, `${finalItems.length} cita(s)`);
  check("Se ve el estado cancelado", finalItems.some((item) => item.status === "cancelled"), "al menos una cancelada");

  section("9. Disponibilidad");
  const availability = await api(`/api/v1/tenants/${tenantA.tenantId}/availability?from=${DATE}&to=${DATE}&durationMinutes=45`, { token: userA.idToken });
  const slots = availability.json?.slots ?? [];
  const slotLabels = slots.map((slot) => slot.startsAtLocal);
  check("Devuelve horarios libres", availability.status === 200 && slots.length > 0, `HTTP ${availability.status}, ${slots.length} horario(s)`);
  check("Los horarios respetan el horario del negocio", slotLabels.every((label) => label.startsWith(DATE) && label.slice(11) >= "09:00" && label.slice(11) < "18:00"), "09:00-18:00");
  check("No ofrece horarios ya ocupados", !slotLabels.includes(`${DATE}T10:30`) && !slotLabels.includes(`${DATE}T12:00`), "10:30 y 12:00 ocupados");
  check("El primer horario del día está libre", slotLabels.includes(`${DATE}T09:00`), "09:00 disponible");
  const sunday = await api(`/api/v1/tenants/${tenantA.tenantId}/availability?from=2030-03-17&to=2030-03-17&durationMinutes=45`, { token: userA.idToken });
  check("Domingo cerrado no ofrece horarios", sunday.status === 200 && (sunday.json?.slots ?? []).length === 0, `HTTP ${sunday.status}`);
  const badDuration = await api(`/api/v1/tenants/${tenantA.tenantId}/availability?from=${DATE}&to=${DATE}&durationMinutes=0`, { token: userA.idToken });
  check("Duración inválida responde 400", badDuration.status === 400, `HTTP ${badDuration.status}`);
  const tenantBAvailability = await api(`/api/v1/tenants/${tenantB.tenantId}/availability?from=${DATE}&to=${DATE}&durationMinutes=45`, { token: userB.idToken });
  const bSlotLabels = (tenantBAvailability.json?.slots ?? []).map((slot) => slot.startsAtLocal);
  check("La disponibilidad de B no se contamina con A", tenantBAvailability.status === 200 && bSlotLabels.includes(`${DATE}T12:00`), `HTTP ${tenantBAvailability.status}`);

  section("10. Reprogramación");
  const moveTarget = beforeCancel.json?.appointment?.appointmentId;
  const moved = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/${moveTarget}/reschedule`, {
    method: "POST", token: userA.idToken, body: { startsAt: `${DATE}T14:00` },
  });
  check("A reprograma una cita a un horario libre", moved.status === 200 && moved.json?.appointment?.startsAtLocal === `${DATE}T14:00`, `HTTP ${moved.status}`);

  const moveConflict = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/${moveTarget}/reschedule`, {
    method: "POST", token: userA.idToken, body: { startsAt: `${DATE}T10:30` },
  });
  check("Reprogramar sobre otra cita da 409", moveConflict.status === 409 && moveConflict.json?.error?.code === "appointment_conflict", `HTTP ${moveConflict.status} ${moveConflict.json?.error?.code ?? ""}`);

  const moveCancelled = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/${appointment.appointmentId}/reschedule`, {
    method: "POST", token: userA.idToken, body: { startsAt: `${DATE}T16:00` },
  });
  check("Una cita cancelada no se reprograma", moveCancelled.status === 409 && moveCancelled.json?.error?.code === "appointment_cancelled", `HTTP ${moveCancelled.status} ${moveCancelled.json?.error?.code ?? ""}`);

  const moveMissing = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/appt_noexiste/reschedule`, {
    method: "POST", token: userA.idToken, body: { startsAt: `${DATE}T16:00` },
  });
  check("Reprogramar una cita inexistente da 404", moveMissing.status === 404, `HTTP ${moveMissing.status}`);

  const moveCross = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/${moveTarget}/reschedule`, {
    method: "POST", token: userB.idToken, body: { startsAt: `${DATE}T17:00` },
  });
  check("B no puede reprogramar citas de A", [403, 404].includes(moveCross.status), `HTTP ${moveCross.status}`);

  const afterMove = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=${DATE}&to=${DATE}`, { token: userA.idToken });
  check("La cita quedó en el nuevo horario", (afterMove.json?.appointments ?? []).some((item) => item.appointmentId === moveTarget && item.startsAtLocal === `${DATE}T14:00`), "persistida a las 14:00");

  section("11. Agente configurable");
  const agentConfig = await api(`/api/v1/tenants/${tenantA.tenantId}/agent/config`, { token: userA.idToken });
  check("La configuración del agente responde", agentConfig.status === 200 && Boolean(agentConfig.json?.config?.provider), `HTTP ${agentConfig.status}`);
  const mockProvider = (agentConfig.json?.available ?? []).find((item) => item.provider === "mock");
  check("El proveedor mock está disponible en local", mockProvider?.configured === true, `mock configured=${mockProvider?.configured}`);
  const foreignUnconfigured = (agentConfig.json?.available ?? []).find((item) => item.provider !== "mock" && item.configured === false);
  check("Los proveedores sin clave aparecen deshabilitados", Boolean(foreignUnconfigured), `ejemplo=${foreignUnconfigured?.provider ?? "ninguno"}`);

  const saved = await api(`/api/v1/tenants/${tenantA.tenantId}/agent/config`, {
    method: "PUT", token: userA.idToken,
    body: { provider: "mock", model: "mock-agent", tone: "formal", instructions: "No agendamos domingos." },
  });
  check("A elige proveedor y modelo", saved.status === 200 && saved.json?.config?.provider === "mock" && saved.json?.config?.model === "mock-agent", `HTTP ${saved.status}`);

  const reread = await api(`/api/v1/tenants/${tenantA.tenantId}/agent/config`, { token: userA.idToken });
  check("La elección queda guardada en el negocio", reread.json?.config?.tone === "formal" && reread.json?.config?.instructions === "No agendamos domingos.", `tone=${reread.json?.config?.tone}`);

  const badProvider = await api(`/api/v1/tenants/${tenantA.tenantId}/agent/config`, {
    method: "PUT", token: userA.idToken, body: { provider: "proveedor-inexistente", model: "x" },
  });
  check("Proveedor desconocido o sin clave responde 400", badProvider.status === 400, `HTTP ${badProvider.status} ${badProvider.json?.error?.code ?? ""}`);

  const badModel = await api(`/api/v1/tenants/${tenantA.tenantId}/agent/config`, {
    method: "PUT", token: userA.idToken, body: { provider: "mock", model: "modelo-inexistente" },
  });
  check("Modelo fuera del proveedor responde 400", badModel.status === 400, `HTTP ${badModel.status} ${badModel.json?.error?.code ?? ""}`);

  const chat = await api(`/api/v1/tenants/${tenantA.tenantId}/agent/messages`, {
    method: "POST", token: userA.idToken, body: { message: "Hola, ¿tienen hueco el viernes?" },
  });
  const chatTool = chat.json?.toolCalls?.[0]?.name;
  check("El agente responde y usa la disponibilidad real", chat.status === 200 && chat.json?.action === "ofrecer_horarios" && chatTool === "consultar_disponibilidad", `HTTP ${chat.status} action=${chat.json?.action} tool=${chatTool}`);
  check("La respuesta declara el modelo elegido", chat.json?.model?.provider === "mock" && chat.json?.model?.model === "mock-agent", `${chat.json?.model?.provider}/${chat.json?.model?.model}`);
  check("La conversación queda identificada", Boolean(chat.json?.conversationId), chat.json?.conversationId);

  const booking = await api(`/api/v1/tenants/${tenantA.tenantId}/agent/messages`, {
    method: "POST", token: userA.idToken, body: { message: "reserva para 2030-04-10T10:00 por favor" },
  });
  check("El agente crea la cita con la herramienta del backend", booking.status === 200 && booking.json?.action === "reservar", `HTTP ${booking.status} action=${booking.json?.action}`);
  const agentAppointments = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=2030-04-10&to=2030-04-10`, { token: userA.idToken });
  const agentAppointment = (agentAppointments.json?.appointments ?? [])[0];
  check("La cita creada por el agente existe en la agenda", agentAppointment?.startsAtLocal === "2030-04-10T10:00", `cita=${agentAppointment?.startsAtLocal ?? "ninguna"}`);

  const crossAgent = await api(`/api/v1/tenants/${tenantA.tenantId}/agent/config`, { token: userB.idToken });
  check("B no puede ver la configuración del agente de A", [403, 404].includes(crossAgent.status), `HTTP ${crossAgent.status}`);

  const noMessage = await api(`/api/v1/tenants/${tenantA.tenantId}/agent/messages`, {
    method: "POST", token: userA.idToken, body: { message: "" },
  });
  check("Un mensaje vacío responde 400", noMessage.status === 400, `HTTP ${noMessage.status}`);

  section("12. Horario del negocio y catálogo de servicios");
  const templated = await api(`/api/v1/tenants/${tenantA.tenantId}/services`, { token: userA.idToken });
  const templatedServices = templated.json?.services ?? [];
  check("La plantilla del sector precarga servicios", templatedServices.length >= 3 && templatedServices.every((item) => item.priceCOP > 0), `${templatedServices.length} servicio(s), ${templatedServices[0]?.name ?? ""}`);
  const contextBefore = await api(`/api/v1/tenants/${tenantA.tenantId}/context`, { token: userA.idToken });
  const hoursBefore = contextBefore.json?.tenant?.openingHours ?? contextBefore.json?.openingHours ?? [];
  check("El contexto trae el horario del negocio", Array.isArray(hoursBefore) && hoursBefore.length === 6, `${hoursBefore.length} día(s) abierto(s)`);

  const weekly = [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "09:00", close: "18:00" }));
  const sundayOpen = await api(`/api/v1/tenants/${tenantA.tenantId}`, {
    method: "PATCH", token: userA.idToken,
    body: { openingHours: [...weekly, { day: 7, open: "10:00", close: "14:00" }], slotStepMinutes: 30 },
  });
  const savedHours = sundayOpen.json?.tenant?.openingHours ?? [];
  check("A configura su horario con domingo abierto", sundayOpen.status === 200 && savedHours.some((entry) => entry.day === 7), `días=${savedHours.length}`);

  const sundaySlots = await api(`/api/v1/tenants/${tenantA.tenantId}/availability?from=2031-01-19&to=2031-01-19&durationMinutes=30`, { token: userA.idToken });
  const sundayList = sundaySlots.json?.slots ?? [];
  const firstSunday = sundayList[0]?.startsAtLocal ?? "";
  const lastSunday = sundayList.at(-1)?.startsAtLocal ?? "";
  check("El domingo abierto genera horarios reales", sundayList.length > 0 && firstSunday.endsWith("T10:00") && lastSunday.endsWith("T13:30"), `${sundayList.length} huecos, ${firstSunday}..${lastSunday}`);

  const sundayClosed = await api(`/api/v1/tenants/${tenantA.tenantId}`, {
    method: "PATCH", token: userA.idToken, body: { openingHours: weekly, slotStepMinutes: 30 },
  });
  const closedSlots = await api(`/api/v1/tenants/${tenantA.tenantId}/availability?from=2031-01-19&to=2031-01-19&durationMinutes=30`, { token: userA.idToken });
  check("Al cerrar el domingo deja de ofrecer horarios", sundayClosed.status === 200 && (closedSlots.json?.slots ?? []).length === 0, `huecos=${(closedSlots.json?.slots ?? []).length}`);

  const repeatedDay = await api(`/api/v1/tenants/${tenantA.tenantId}`, {
    method: "PATCH", token: userA.idToken,
    body: { openingHours: [...weekly, { day: 1, open: "09:00", close: "18:00" }] },
  });
  check("Un día repetido responde 400", repeatedDay.status === 400 && repeatedDay.json?.error?.code === "invalid_hours", `HTTP ${repeatedDay.status} ${repeatedDay.json?.error?.code ?? ""}`);

  const badStep = await api(`/api/v1/tenants/${tenantA.tenantId}`, {
    method: "PATCH", token: userA.idToken, body: { slotStepMinutes: 4 },
  });
  check("Un intervalo inválido responde 400", badStep.status === 400 && badStep.json?.error?.code === "invalid_slot_step", `HTTP ${badStep.status} ${badStep.json?.error?.code ?? ""}`);

  const serviceCreated = await api(`/api/v1/tenants/${tenantA.tenantId}/services`, {
    method: "POST", token: userA.idToken,
    body: { name: "Corte clásico", category: "Cortes", durationMinutes: 45, priceCOP: 50000 },
  });
  const svc = serviceCreated.json?.service ?? {};
  check("A crea un servicio con precio", serviceCreated.status === 201 && svc.priceCOP === 50000 && svc.durationMinutes === 45, `HTTP ${serviceCreated.status} ${svc.name ?? ""}`);
  const serviceId = svc.serviceId ?? svc.id;

  const duplicate = await api(`/api/v1/tenants/${tenantA.tenantId}/services`, {
    method: "POST", token: userA.idToken,
    body: { name: "CORTE CLASICO", durationMinutes: 30, priceCOP: 40000 },
  });
  check("Un servicio repetido responde 409", duplicate.status === 409 && duplicate.json?.error?.code === "service_name_taken", `HTTP ${duplicate.status}`);

  const svcBadPrice = await api(`/api/v1/tenants/${tenantA.tenantId}/services`, {
    method: "POST", token: userA.idToken, body: { name: "Corte raro", durationMinutes: 45, priceCOP: -5 },
  });
  check("Un precio inválido responde 400", svcBadPrice.status === 400 && svcBadPrice.json?.error?.code === "invalid_price", `HTTP ${svcBadPrice.status} ${svcBadPrice.json?.error?.code ?? ""}`);

  const svcEdited = await api(`/api/v1/tenants/${tenantA.tenantId}/services/${serviceId}`, {
    method: "PATCH", token: userA.idToken, body: { priceCOP: 60000 },
  });
  check("El dueño puede cambiar el precio", svcEdited.status === 200 && svcEdited.json?.service?.priceCOP === 60000, `precio=${svcEdited.json?.service?.priceCOP}`);

  const svcListed = await api(`/api/v1/tenants/${tenantA.tenantId}/services`, { token: userA.idToken });
  check("El servicio aparece en el catálogo", (svcListed.json?.services ?? []).some((item) => item.name === "Corte clásico"), `${(svcListed.json?.services ?? []).length} servicio(s)`);

  const svcRemoved = await api(`/api/v1/tenants/${tenantA.tenantId}/services/${serviceId}`, { method: "DELETE", token: userA.idToken });
  const svcAfterRemoval = await api(`/api/v1/tenants/${tenantA.tenantId}/services`, { token: userA.idToken });
  check("Desactivar un servicio lo oculta del catálogo", svcRemoved.status === 200 && !(svcAfterRemoval.json?.services ?? []).some((item) => item.name === "Corte clásico"), `activos=${(svcAfterRemoval.json?.services ?? []).length}`);

  const crossServices = await api(`/api/v1/tenants/${tenantA.tenantId}/services`, { token: userB.idToken });
  check("B no puede ver los servicios de A", [403, 404].includes(crossServices.status), `HTTP ${crossServices.status}`);

  section("13. Clientes con ficha e historial");
  const customerCreated = await api(`/api/v1/tenants/${tenantA.tenantId}/customers`, {
    method: "POST", token: userA.idToken, body: { name: "Camila Rojas", phone: "3001234567", notes: "Prefiere corte con máquina 2." },
  });
  const customer = customerCreated.json?.customer ?? {};
  const customerId = customer.customerId ?? customer.id;
  check("A crea un cliente con teléfono", customerCreated.status === 201 && customer.phone === "3001234567", `HTTP ${customerCreated.status} ${customer.name ?? ""}`);

  const byName = await api(`/api/v1/tenants/${tenantA.tenantId}/customers?query=Camila`, { token: userA.idToken });
  const byPhone = await api(`/api/v1/tenants/${tenantA.tenantId}/customers?query=3001234567`, { token: userA.idToken });
  check("Se busca por nombre y por teléfono", (byName.json?.customers ?? []).length > 0 && (byPhone.json?.customers ?? []).length > 0, `nombre=${(byName.json?.customers ?? []).length} teléfono=${(byPhone.json?.customers ?? []).length}`);

  const duplicatePhone = await api(`/api/v1/tenants/${tenantA.tenantId}/customers`, {
    method: "POST", token: userA.idToken, body: { name: "Otra Camila", phone: "300 123 4567" },
  });
  check("Un teléfono repetido responde 409", duplicatePhone.status === 409 && duplicatePhone.json?.error?.code === "customer_phone_taken", `HTTP ${duplicatePhone.status}`);

  const badPhone = await api(`/api/v1/tenants/${tenantA.tenantId}/customers`, {
    method: "POST", token: userA.idToken, body: { name: "Sin teléfono válido", phone: "12" },
  });
  check("Un teléfono inválido responde 400", badPhone.status === 400 && badPhone.json?.error?.code === "invalid_customer_phone", `HTTP ${badPhone.status} ${badPhone.json?.error?.code ?? ""}`);

  const linkedAppointment = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerId, serviceName: "Corte clásico", startsAt: "2030-05-14T11:00", durationMinutes: 45, priceCOP: 55000 },
  });
  const linked = linkedAppointment.json?.appointment ?? {};
  check("La cita queda vinculada al cliente", linkedAppointment.status === 201 && linked.customerId === customerId && linked.customerName === "Camila Rojas", `customerId=${linked.customerId}`);

  const detail = await api(`/api/v1/tenants/${tenantA.tenantId}/customers/${customerId}`, { token: userA.idToken });
  const history = detail.json?.appointments ?? [];
  check("La ficha del cliente trae su historial", detail.status === 200 && history.some((item) => item.appointmentId === linked.appointmentId || item.id === linked.appointmentId), `${history.length} cita(s)`);

  const crossCustomer = await api(`/api/v1/tenants/${tenantA.tenantId}/customers`, { token: userB.idToken });
  check("B no puede ver los clientes de A", [403, 404].includes(crossCustomer.status), `HTTP ${crossCustomer.status}`);

  const foreignAppointment = await api(`/api/v1/tenants/${tenantB.tenantId}/appointments`, {
    method: "POST", token: userB.idToken,
    body: { customerId, serviceName: "Corte", startsAt: "2030-05-15T11:00", durationMinutes: 30, priceCOP: 0 },
  });
  check("No se puede usar un cliente de otro negocio", foreignAppointment.status === 404 && foreignAppointment.json?.error?.code === "customer_not_found", `HTTP ${foreignAppointment.status} ${foreignAppointment.json?.error?.code ?? ""}`);

  const customerDeleted = await api(`/api/v1/tenants/${tenantA.tenantId}/customers/${customerId}`, { method: "DELETE", token: userA.idToken });
  const activeList = await api(`/api/v1/tenants/${tenantA.tenantId}/customers`, { token: userA.idToken });
  const inactiveList = await api(`/api/v1/tenants/${tenantA.tenantId}/customers?includeInactive=1`, { token: userA.idToken });
  check("Desactivar un cliente lo saca de la lista", customerDeleted.status === 200 && (customerDeleted.json?.customer?.active === false) && !(activeList.json?.customers ?? []).some((item) => item.name === "Camila Rojas"), `activos=${(activeList.json?.customers ?? []).length} con inactivos=${(inactiveList.json?.customers ?? []).length}`);

  section("14. Panel de plataforma");
  const adminEmail = "admin@alaia.test";
  let adminSignIn = await http(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    { method: "POST", body: { email: adminEmail, password: "Secreta123!", returnSecureToken: true } },
  );
  if (adminSignIn.status !== 200 || !adminSignIn.json?.idToken) {
    adminSignIn = await http(
      `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
      { method: "POST", body: { email: adminEmail, password: "Secreta123!", returnSecureToken: true } },
    );
  }
  const admin = { email: adminEmail, idToken: adminSignIn.json?.idToken };

  const adminMe = await api("/api/v1/me", { token: admin.idToken });
  check("El administrador de plataforma se reconoce", adminMe.status === 200 && (adminMe.json?.user?.isPlatformAdmin === true || adminMe.json?.isPlatformAdmin === true), `HTTP ${adminMe.status}`);

  const forbidden = await api("/api/v1/platform/tenants", { token: userA.idToken });
  check("Un dueño normal no entra al panel de plataforma", forbidden.status === 403 && forbidden.json?.error?.code === "not_platform_admin", `HTTP ${forbidden.status} ${forbidden.json?.error?.code ?? ""}`);

  const platformSummary = await api("/api/v1/platform/summary", { token: admin.idToken });
  check("El resumen de la plataforma responde", platformSummary.status === 200 && Number.isFinite(platformSummary.json?.tenants?.total), `negocios=${platformSummary.json?.tenants?.total}`);

  const platformList = await api("/api/v1/platform/tenants", { token: admin.idToken });
  const listedTenants = platformList.json?.tenants ?? [];
  const tenantAEntry = listedTenants.find((item) => item.tenantId === tenantA.tenantId);
  check("El administrador ve los negocios con su consumo", platformList.status === 200 && Boolean(tenantAEntry), `${listedTenants.length} negocio(s)`);

  const badPlan = await api(`/api/v1/platform/tenants/${tenantB.tenantId}`, { method: "PATCH", token: admin.idToken, body: { plan: "platino" } });
  check("Un plan inválido responde 400", badPlan.status === 400 && badPlan.json?.error?.code === "invalid_plan", `HTTP ${badPlan.status}`);

  const planChanged = await api(`/api/v1/platform/tenants/${tenantB.tenantId}`, { method: "PATCH", token: admin.idToken, body: { plan: "basico" } });
  check("El administrador cambia el plan", planChanged.status === 200 && (planChanged.json?.tenant?.plan === "basico"), `plan=${planChanged.json?.tenant?.plan}`);

  const suspended = await api(`/api/v1/platform/tenants/${tenantB.tenantId}`, { method: "PATCH", token: admin.idToken, body: { status: "suspended" } });
  check("El administrador suspende un negocio", suspended.status === 200 && suspended.json?.tenant?.status === "suspended", `estado=${suspended.json?.tenant?.status}`);

  const blocked = await api(`/api/v1/tenants/${tenantB.tenantId}/appointments?from=${DATE}&to=${DATE}`, { token: userB.idToken });
  check("Un negocio suspendido no puede operar", blocked.status === 403 && blocked.json?.error?.code === "tenant_suspended", `HTTP ${blocked.status} ${blocked.json?.error?.code ?? ""}`);

  const reactivated = await api(`/api/v1/platform/tenants/${tenantB.tenantId}`, { method: "PATCH", token: admin.idToken, body: { status: "active" } });
  const workingAgain = await api(`/api/v1/tenants/${tenantB.tenantId}/appointments?from=${DATE}&to=${DATE}`, { token: userB.idToken });
  check("Al reactivar el negocio vuelve a operar", reactivated.status === 200 && workingAgain.status === 200, `HTTP ${workingAgain.status}`);

  section("15. Perfil del negocio y resumen");
  const profileSaved = await api(`/api/v1/tenants/${tenantA.tenantId}`, {
    method: "PATCH", token: userA.idToken,
    body: {
      description: "Barbería con estilo, en el centro de Bogotá.",
      address: "Calle 45 #12-30, Bogotá",
      phone: "+57 601 234 5678",
      socialLinks: { instagram: "https://instagram.com/barberia", whatsapp: "3001234567" },
    },
  });
  const profileTenant = profileSaved.json?.tenant ?? {};
  check("El negocio guarda su perfil y redes", profileSaved.status === 200 && profileTenant.socialLinks?.instagram === "https://instagram.com/barberia", `HTTP ${profileSaved.status}`);

  const profileContext = await api(`/api/v1/tenants/${tenantA.tenantId}/context`, { token: userA.idToken });
  const contextTenant = profileContext.json?.tenant ?? profileContext.json ?? {};
  check("El perfil viaja en el contexto", contextTenant.description === "Barbería con estilo, en el centro de Bogotá." && Boolean(contextTenant.socialLinks?.whatsapp), `descripción=${Boolean(contextTenant.description)}`);

  const badSocial = await api(`/api/v1/tenants/${tenantA.tenantId}`, {
    method: "PATCH", token: userA.idToken, body: { socialLinks: { instagram: "instagram.com/sin-https" } },
  });
  check("Una red sin https responde 400", badSocial.status === 400 && badSocial.json?.error?.code === "invalid_social_link", `HTTP ${badSocial.status} ${badSocial.json?.error?.code ?? ""}`);

  const longDescription = await api(`/api/v1/tenants/${tenantA.tenantId}`, {
    method: "PATCH", token: userA.idToken, body: { description: "x".repeat(301) },
  });
  check("Una descripción demasiado larga responde 400", longDescription.status === 400 && longDescription.json?.error?.code === "invalid_description", `HTTP ${longDescription.status}`);

  const dashboardDay = "2031-03-10";
  const dashFirst = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Resumen", serviceName: "Corte clásico", startsAt: `${dashboardDay}T10:00`, durationMinutes: 45, priceCOP: 50000 },
  });
  const dashSecond = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Resumen", serviceName: "Arreglo de barba", startsAt: `${dashboardDay}T11:00`, durationMinutes: 30, priceCOP: 30000 },
  });
  const dashCancelled = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Resumen", serviceName: "Corte clásico", startsAt: `${dashboardDay}T12:00`, durationMinutes: 30, priceCOP: 90000 },
  });
  await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/${dashCancelled.json?.appointment?.appointmentId}/cancel`, { method: "POST", token: userA.idToken, body: {} });
  await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/${dashSecond.json?.appointment?.appointmentId}/reschedule`, {
    method: "POST", token: userA.idToken, body: { startsAt: `${dashboardDay}T13:00`, durationMinutes: 30 },
  }).catch(() => {});

  const dashboard = await api(`/api/v1/tenants/${tenantA.tenantId}/dashboard?date=${dashboardDay}`, { token: userA.idToken });
  const metrics = dashboard.json ?? {};
  check("El resumen cuenta citas e ingresos del día", dashboard.status === 200 && metrics.appointments?.today === 2 && metrics.income?.today === 80000, `citas=${metrics.appointments?.today} ingresos=${metrics.income?.today}`);
  check("La cita cancelada no suma ingresos", metrics.appointments?.cancelled === 1 && metrics.income?.month === 80000, `canceladas=${metrics.appointments?.cancelled} mes=${metrics.income?.month}`);
  check("El resumen incluye clientes del negocio", Number.isFinite(metrics.customers?.total) && metrics.customers.total >= 0, `total=${metrics.customers?.total}`);
  const topServices = metrics.topServices ?? [];
  check("El resumen lista los servicios más pedidos", topServices.length > 0 && topServices[0]?.name === "Corte clásico" && topServices[0]?.income === 50000, `${topServices.length} servicio(s)`);

  const foreignDashboard = await api(`/api/v1/tenants/${tenantA.tenantId}/dashboard?date=${dashboardDay}`, { token: userB.idToken });
  check("B no puede ver el resumen de A", [403, 404].includes(foreignDashboard.status), `HTTP ${foreignDashboard.status}`);

  section("16. Proveedores de IA y prueba de negocios");
  const providersList = await api("/api/v1/platform/providers", { token: admin.idToken });
  const providerList = providersList.json?.providers ?? [];
  const mockEntry = providerList.find((item) => item.provider === "mock");
  check("El administrador ve los proveedores", providersList.status === 200 && providerList.length >= 4, `${providerList.length} proveedor(es)`);
  check("Las claves se muestran enmascaradas", providerList.every((item) => !item.apiKey && (!item.maskedKey || String(item.maskedKey).startsWith("…"))), `mock=${mockEntry?.maskedKey ?? "sin clave"}`);

  const ownersProviders = await api("/api/v1/platform/providers", { token: userA.idToken });
  check("Un dueño normal no ve los proveedores", ownersProviders.status === 403 && ownersProviders.json?.error?.code === "not_platform_admin", `HTTP ${ownersProviders.status}`);

  const mockKey = "sk-verify-mock-9999";
  const providerSaved = await api("/api/v1/platform/providers/mock", {
    method: "PUT", token: admin.idToken,
    body: { enabled: true, apiKey: mockKey, models: ["mock-agent"], defaultModel: "mock-agent" },
  });
  const providerSavedBody = JSON.stringify(providerSaved.json ?? {});
  check("El administrador guarda una clave", providerSaved.status === 200 && providerSaved.json?.provider?.source === "platform", `HTTP ${providerSaved.status} source=${providerSaved.json?.provider?.source}`);
  check("La clave completa no vuelve en la respuesta", !providerSavedBody.includes(mockKey), `masked=${providerSaved.json?.provider?.maskedKey}`);

  const badModels = await api("/api/v1/platform/providers/mock", { method: "PUT", token: admin.idToken, body: { models: [] } });
  check("Una lista de modelos vacía responde 400", badModels.status === 400 && badModels.json?.error?.code === "invalid_models", `HTTP ${badModels.status}`);

  const badDefaultModel = await api("/api/v1/platform/providers/mock", { method: "PUT", token: admin.idToken, body: { models: ["mock-agent"], defaultModel: "otro-modelo" } });
  check("Un modelo por defecto fuera de la lista responde 400", badDefaultModel.status === 400 && badDefaultModel.json?.error?.code === "invalid_model", `HTTP ${badDefaultModel.status}`);

  const providerTest = await api("/api/v1/platform/providers/mock/test", { method: "POST", token: admin.idToken, body: {} });
  check("La prueba de conexión funciona", providerTest.status === 200 && providerTest.json?.ok === true, `latencia=${providerTest.json?.latencyMs}ms`);

  const providerRemoved = await api("/api/v1/platform/providers/mock", { method: "DELETE", token: admin.idToken });
  check("Quitar la configuración vuelve al entorno", providerRemoved.status === 200 && ["env", "none"].includes(providerRemoved.json?.provider?.source), `source=${providerRemoved.json?.provider?.source}`);

  const meTenants = await api("/api/v1/me/tenants", { token: userA.idToken });
  const ownTenant = (meTenants.json?.tenants ?? []).find((item) => item.tenantId === tenantA.tenantId);
  check("El negocio nuevo entra en periodo de prueba", ownTenant?.plan === "trial" && Number.isInteger(ownTenant?.trialDaysLeft) && ownTenant.trialDaysLeft > 0, `plan=${ownTenant?.plan} días=${ownTenant?.trialDaysLeft}`);

  section("17. Equipo y citas asignadas");
  const proOne = await api(`/api/v1/tenants/${tenantA.tenantId}/professionals`, {
    method: "POST", token: userA.idToken,
    body: { name: "Andrés Barbero", phone: "3001112233", commission: { type: "percentage", percent: 50, effectiveFrom: "2026-01-01" } },
  });
  const proTwo = await api(`/api/v1/tenants/${tenantA.tenantId}/professionals`, {
    method: "POST", token: userA.idToken,
    body: { name: "Camila Estilista", phone: "3004445566", commission: { type: "fixed", amountCOP: 15000, effectiveFrom: "2026-01-01" } },
  });
  const proOneId = proOne.json?.professional?.professionalId ?? proOne.json?.professional?.id;
  const proTwoId = proTwo.json?.professional?.professionalId ?? proTwo.json?.professional?.id;
  check("A crea dos profesionales", proOne.status === 201 && proTwo.status === 201, `HTTP ${proOne.status}/${proTwo.status}`);

  const duplicatePro = await api(`/api/v1/tenants/${tenantA.tenantId}/professionals`, {
    method: "POST", token: userA.idToken,
    body: { name: "ANDRÉS BARBERO", commission: { type: "percentage", percent: 40, effectiveFrom: "2026-01-01" } },
  });
  check("Un profesional repetido responde 409", duplicatePro.status === 409 && duplicatePro.json?.error?.code === "professional_name_taken", `HTTP ${duplicatePro.status}`);

  const badPercent = await api(`/api/v1/tenants/${tenantA.tenantId}/professionals`, {
    method: "POST", token: userA.idToken,
    body: { name: "Porcentaje inválido", commission: { type: "percentage", percent: 150, effectiveFrom: "2026-01-01" } },
  });
  check("Un porcentaje inválido responde 400", badPercent.status === 400 && badPercent.json?.error?.code === "invalid_percent", `HTTP ${badPercent.status} ${badPercent.json?.error?.code ?? ""}`);

  const teamDay = "2032-04-05";
  const proAppointment = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Equipo", serviceName: "Corte clásico", startsAt: `${teamDay}T10:00`, durationMinutes: 45, priceCOP: 50000, professionalId: proOneId },
  });
  check("La cita se asigna al profesional", proAppointment.status === 201 && proAppointment.json?.appointment?.professionalName === "Andrés Barbero", `professionalId=${proAppointment.json?.appointment?.professionalId}`);

  const otherProSameTime = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Equipo 2", serviceName: "Corte clásico", startsAt: `${teamDay}T10:00`, durationMinutes: 45, priceCOP: 50000, professionalId: proTwoId },
  });
  check("Dos profesionales pueden atender a la misma hora", otherProSameTime.status === 201, `HTTP ${otherProSameTime.status}`);

  const sameProConflict = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Equipo 3", serviceName: "Corte clásico", startsAt: `${teamDay}T10:00`, durationMinutes: 45, priceCOP: 50000, professionalId: proOneId },
  });
  check("El mismo profesional no puede tener dos citas a la vez", sameProConflict.status === 409 && sameProConflict.json?.error?.code === "appointment_conflict", `HTTP ${sameProConflict.status}`);

  const unassigned = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Sin Asignar", serviceName: "Corte clásico", startsAt: `${teamDay}T10:00`, durationMinutes: 45, priceCOP: 50000 },
  });
  check("Una cita sin asignar convive con las asignadas", unassigned.status === 201, `HTTP ${unassigned.status}`);

  const secondUnassigned = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Sin Asignar 2", serviceName: "Corte clásico", startsAt: `${teamDay}T10:00`, durationMinutes: 45, priceCOP: 50000 },
  });
  check("Dos citas sin asignar se cruzan", secondUnassigned.status === 409, `HTTP ${secondUnassigned.status}`);

  const proAvailability = await api(`/api/v1/tenants/${tenantA.tenantId}/availability?from=${teamDay}&to=${teamDay}&durationMinutes=45&stepMinutes=30&professionalId=${proOneId}`, { token: userA.idToken });
  const proSlotTimes = (proAvailability.json?.slots ?? []).map((slot) => slot.startsAtLocal);
  check("La disponibilidad del profesional respeta sus citas", !proSlotTimes.includes(`${teamDay}T10:00`) && proSlotTimes.includes(`${teamDay}T11:00`), `${proSlotTimes.length} huecos`);

  const foreignProfessionals = await api(`/api/v1/tenants/${tenantA.tenantId}/professionals`, { token: userB.idToken });
  check("B no puede ver los profesionales de A", [403, 404].includes(foreignProfessionals.status), `HTTP ${foreignProfessionals.status}`);

  section("18. Liquidación de comisiones");
  const rentPro = await api(`/api/v1/tenants/${tenantA.tenantId}/professionals`, {
    method: "POST", token: userA.idToken,
    body: { name: "Renta Puesto", commission: { type: "rent", rentCOP: 310000, effectiveFrom: "2026-01-01" } },
  });
  const rentProId = rentPro.json?.professional?.professionalId ?? rentPro.json?.professional?.id;

  const payDay = "2032-05";
  await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Liquidación", serviceName: "Corte clásico", startsAt: `${payDay}-10T10:00`, durationMinutes: 45, priceCOP: 100000, professionalId: proOneId },
  });
  await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Liquidación", serviceName: "Corte clásico", startsAt: `${payDay}-11T10:00`, durationMinutes: 45, priceCOP: 60000, professionalId: proTwoId },
  });
  await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Liquidación", serviceName: "Corte clásico", startsAt: `${payDay}-12T10:00`, durationMinutes: 45, priceCOP: 40000 },
  });
  await api(`/api/v1/tenants/${tenantA.tenantId}/appointments`, {
    method: "POST", token: userA.idToken,
    body: { customerName: "Cliente Renta", serviceName: "Corte clásico", startsAt: `${payDay}-13T10:00`, durationMinutes: 45, priceCOP: 50000, professionalId: rentProId },
  });

  const settlement = await api(`/api/v1/tenants/${tenantA.tenantId}/settlements/preview?from=${payDay}-01&to=${payDay}-31`, { token: userA.idToken });
  const settlementBody = settlement.json ?? {};
  const professionalRows = settlementBody.professionals ?? [];
  const rowFor = (name) => professionalRows.find((row) => row.name === name);
  const andresRow = rowFor("Andrés Barbero");
  const camilaRow = rowFor("Camila Estilista");
  const rentaRow = rowFor("Renta Puesto");
  check("La liquidación resume el negocio", settlement.status === 200 && settlementBody.business?.gross === 250000, `producido=${settlementBody.business?.gross} servicios=${settlementBody.business?.services}`);
  check("El 50% se calcula sobre el producido", andresRow?.commission === 50000 && andresRow?.net === 50000, `comisión=${andresRow?.commission}`);
  check("El fijo se multiplica por servicio", camilaRow?.commission === 15000 && camilaRow?.net === 15000, `comisión=${camilaRow?.commission}`);
  check("El alquiler se prorratea por el rango", rentaRow?.rent === 310000 && rentaRow?.commission === 0 && rentaRow?.net === -310000, `alquiler=${rentaRow?.rent} neto=${rentaRow?.net}`);
  check("Las citas sin asignar se separan", settlementBody.unassigned?.gross === 40000, `sin asignar=${settlementBody.unassigned?.gross}`);

  const settlementBadRange = await api(`/api/v1/tenants/${tenantA.tenantId}/settlements/preview?from=${payDay}-31&to=${payDay}-01`, { token: userA.idToken });
  check("Un rango invertido responde 400", settlementBadRange.status === 400 && settlementBadRange.json?.error?.code === "invalid_range", `HTTP ${settlementBadRange.status} ${settlementBadRange.json?.error?.code ?? ""}`);

  const settlementLongRange = await api(`/api/v1/tenants/${tenantA.tenantId}/settlements/preview?from=2032-01-01&to=2032-12-31`, { token: userA.idToken });
  check("Un rango de más de 92 días responde 400", settlementLongRange.status === 400 && settlementLongRange.json?.error?.code === "invalid_range", `HTTP ${settlementLongRange.status}`);

  section("19. Invitaciones y panel del profesional");
  const invitation = await api(`/api/v1/tenants/${tenantA.tenantId}/invitations`, {
    method: "POST", token: userA.idToken, body: { professionalId: proOneId, email: `invitado-${RUN_ID}@alaia.test` },
  });
  const invitationBody = invitation.json?.invitation ?? {};
  check("El dueño crea una invitación con enlace y QR", invitation.status === 201 && Boolean(invitationBody.link) && invitationBody.qrPayload === invitationBody.link, `HTTP ${invitation.status}`);

  const invitationsList = await api(`/api/v1/tenants/${tenantA.tenantId}/invitations`, { token: userA.idToken });
  const listedInvitation = (invitationsList.json?.invitations ?? []).find((item) => item.invitationId === invitationBody.id || item.id === invitationBody.id);
  const listText = JSON.stringify(invitationsList.json ?? {});
  check("El listado oculta el token y su hash", Boolean(listedInvitation) && !listText.includes("tokenHash") && !listText.includes(invitationBody.link?.split("/").pop() ?? "###"), `${(invitationsList.json?.invitations ?? []).length} invitación(es)`);

  const token = String(invitationBody.link ?? "").split("/invite/")[1] ?? "";
  const publicInvitation = await api(`/api/v1/invitations/${token}`);
  check("La invitación se puede abrir sin sesión", publicInvitation.status === 200 && publicInvitation.json?.professional?.name === "Andrés Barbero", `HTTP ${publicInvitation.status}`);

  const invitedUser = await signUp(`prof-${RUN_ID}`);
  const accepted = await api(`/api/v1/invitations/${token}/accept`, { method: "POST", token: invitedUser.idToken, body: {} });
  check("El profesional acepta y queda vinculado", accepted.status === 200 && accepted.json?.membership?.role === "professional" && accepted.json?.membership?.professionalId === proOneId, `rol=${accepted.json?.membership?.role}`);

  const repeatAccept = await api(`/api/v1/invitations/${token}/accept`, { method: "POST", token: invitedUser.idToken, body: {} });
  check("Aceptar dos veces responde 409", [409, 403].includes(repeatAccept.status), `HTTP ${repeatAccept.status}`);

  const professionalAppointments = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments?from=2032-04-01&to=2032-05-31`, { token: invitedUser.idToken });
  const professionalList = professionalAppointments.json?.appointments ?? [];
  check("El profesional solo ve sus citas", professionalList.length === 2 && professionalList.every((item) => item.professionalId === proOneId), `${professionalList.length} cita(s)`);

  const forbiddenService = await api(`/api/v1/tenants/${tenantA.tenantId}/services`, {
    method: "POST", token: invitedUser.idToken, body: { name: "Servicio del profesional", durationMinutes: 30, priceCOP: 10000 },
  });
  check("El profesional no puede crear servicios", forbiddenService.status === 403, `HTTP ${forbiddenService.status}`);

  const attendance = await api(`/api/v1/tenants/${tenantA.tenantId}/appointments/${proAppointment.json?.appointment?.appointmentId}/status`, {
    method: "POST", token: invitedUser.idToken, body: { status: "completed" },
  });
  check("El profesional marca su cita como atendida", attendance.status === 200 && attendance.json?.appointment?.status === "completed", `estado=${attendance.json?.appointment?.status}`);

  const invalidInvitation = await api("/api/v1/invitations/token-inventado-123");
  check("Un token inventado responde 404", invalidInvitation.status === 404 && invalidInvitation.json?.error?.code === "invitation_not_found", `HTTP ${invalidInvitation.status}`);

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones pasan.`);
  if (failed.length) {
    console.log("Fallaron:");
    for (const item of failed) console.log(`  - ${item.name} (${item.detail})`);
    process.exit(1);
  }
  console.log(`Negocios de prueba: A=${tenantA.tenantId} B=${tenantB.tenantId}`);
}

main().catch((error) => {
  console.error("\nError inesperado en la verificación:", error.message);
  process.exit(1);
});

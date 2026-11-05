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

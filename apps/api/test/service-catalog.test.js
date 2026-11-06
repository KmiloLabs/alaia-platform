import test from "node:test";
import assert from "node:assert/strict";
import {
  createService,
  deactivateService,
  getActiveService,
  isValidServiceId,
  listActiveServices,
  listServices,
  normalizeServiceName,
  updateService,
  validateServiceInput,
} from "../src/service-catalog.js";

function createFakeRepository() {
  const docs = new Map();
  let counter = 0;
  return {
    docs,
    async list() {
      return [...docs.entries()].map(([serviceId, data]) => ({ serviceId, data }));
    },
    async get(_tenantId, serviceId) {
      return docs.has(serviceId) ? { serviceId, data: docs.get(serviceId) } : null;
    },
    async create(_tenantId, data) {
      counter += 1;
      const serviceId = `svc_${counter}`;
      const now = new Date(2026, 0, 1, 0, counter);
      docs.set(serviceId, { ...data, id: serviceId, createdAt: now, updatedAt: now });
      return { serviceId, data: docs.get(serviceId) };
    },
    async update(_tenantId, serviceId, data) {
      const updated = { ...docs.get(serviceId), ...data, updatedAt: new Date(2026, 0, 2, 0, counter) };
      docs.set(serviceId, updated);
      return { serviceId, data: updated };
    },
  };
}

const VALID_BODY = {
  name: "Corte clásico",
  description: "Corte con máquina y tijera",
  category: "Cortes",
  durationMinutes: 45,
  priceCOP: 50000,
};

test("valida el alta de servicios y aplica defaults", () => {
  const result = validateServiceInput(VALID_BODY);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, VALID_BODY);

  const minimal = validateServiceInput({ name: "Corte", durationMinutes: 30, priceCOP: 0 });
  assert.equal(minimal.ok, true);
  assert.deepEqual(minimal.value, {
    name: "Corte",
    description: "",
    category: "",
    durationMinutes: 30,
    priceCOP: 0,
  });

  const partial = validateServiceInput({ priceCOP: 60000 }, { partial: true });
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.value, { priceCOP: 60000 });
});

test("códigos de error de validación de servicios", () => {
  const cases = [
    ["invalid_service_name", { durationMinutes: 30, priceCOP: 0 }],
    ["invalid_service_name", { name: "A", durationMinutes: 30, priceCOP: 0 }],
    ["invalid_service_name", { name: "x".repeat(81), durationMinutes: 30, priceCOP: 0 }],
    ["invalid_service_description", { ...VALID_BODY, description: "x".repeat(301) }],
    ["invalid_service_description", { ...VALID_BODY, description: 42 }],
    ["invalid_service_category", { ...VALID_BODY, category: "x".repeat(41) }],
    ["invalid_service_category", { ...VALID_BODY, category: 42 }],
    ["invalid_duration", { ...VALID_BODY, durationMinutes: 4 }],
    ["invalid_duration", { ...VALID_BODY, durationMinutes: 481 }],
    ["invalid_duration", { ...VALID_BODY, durationMinutes: "45" }],
    ["invalid_price", { ...VALID_BODY, priceCOP: -1 }],
    ["invalid_price", { ...VALID_BODY, priceCOP: 10_000_001 }],
    ["invalid_price", { ...VALID_BODY, priceCOP: 50.5 }],
  ];
  for (const [code, body] of cases) {
    const result = validateServiceInput(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, code, JSON.stringify(body));
  }
});

test("crea un servicio activo con id y fechas", async () => {
  const repository = createFakeRepository();
  const result = await createService({ tenantId: "t1", body: VALID_BODY, repository });
  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
  assert.equal(result.service.serviceId, "svc_1");
  assert.equal(result.service.id, "svc_1");
  assert.equal(result.service.name, "Corte clásico");
  assert.equal(result.service.active, true);
  assert.equal(result.service.priceCOP, 50000);
  assert.equal(typeof result.service.createdAt, "string");
  assert.equal(repository.docs.size, 1);
});

test("nombre duplicado sin distinguir mayúsculas, espacios ni acentos", async () => {
  const repository = createFakeRepository();
  await createService({ tenantId: "t1", body: VALID_BODY, repository });

  for (const name of ["Corte clásico", "CORTE CLASICO", "  corte   clásico  "]) {
    const duplicate = await createService({
      tenantId: "t1",
      body: { ...VALID_BODY, name },
      repository,
    });
    assert.equal(duplicate.ok, false, name);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.code, "service_name_taken");
  }

  const other = await createService({
    tenantId: "t1",
    body: { ...VALID_BODY, name: "Barba" },
    repository,
  });
  assert.equal(other.ok, true);
  assert.equal(repository.docs.size, 2);
});

test("actualiza campos y evita nombres duplicados al renombrar", async () => {
  const repository = createFakeRepository();
  const first = await createService({ tenantId: "t1", body: VALID_BODY, repository });
  await createService({ tenantId: "t1", body: { ...VALID_BODY, name: "Barba" }, repository });

  const updated = await updateService({
    tenantId: "t1",
    serviceId: first.service.serviceId,
    body: { priceCOP: 60000 },
    repository,
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.service.priceCOP, 60000);
  assert.equal(updated.service.name, "Corte clásico");

  const duplicate = await updateService({
    tenantId: "t1",
    serviceId: first.service.serviceId,
    body: { name: "barba" },
    repository,
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, "service_name_taken");

  const sameName = await updateService({
    tenantId: "t1",
    serviceId: first.service.serviceId,
    body: { name: "Corte Clásico" },
    repository,
  });
  assert.equal(sameName.ok, true);

  const missing = await updateService({ tenantId: "t1", serviceId: "svc_999", body: { priceCOP: 1 }, repository });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "service_not_found");

  const invalid = await updateService({ tenantId: "t1", serviceId: first.service.serviceId, body: { priceCOP: -5 }, repository });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "invalid_price");

  const badId = await updateService({ tenantId: "t1", serviceId: "id con espacios", body: { priceCOP: 1 }, repository });
  assert.equal(badId.ok, false);
  assert.equal(badId.status, 404);
});

test("el borrado es lógico: conserva el documento con active=false", async () => {
  const repository = createFakeRepository();
  const created = await createService({ tenantId: "t1", body: VALID_BODY, repository });
  const serviceId = created.service.serviceId;

  const deleted = await deactivateService({ tenantId: "t1", serviceId, repository });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.service.active, false);
  assert.equal(repository.docs.has(serviceId), true);
  assert.equal(repository.docs.get(serviceId).active, false);

  const again = await deactivateService({ tenantId: "t1", serviceId, repository });
  assert.equal(again.ok, true);
  assert.equal(again.service.active, false);

  const missing = await deactivateService({ tenantId: "t1", serviceId: "svc_999", repository });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "service_not_found");
});

test("lista solo activos salvo includeInactive", async () => {
  const repository = createFakeRepository();
  const first = await createService({ tenantId: "t1", body: VALID_BODY, repository });
  await createService({ tenantId: "t1", body: { ...VALID_BODY, name: "Barba" }, repository });
  await deactivateService({ tenantId: "t1", serviceId: first.service.serviceId, repository });

  const active = await listServices({ tenantId: "t1", repository });
  assert.equal(active.ok, true);
  assert.deepEqual(active.services.map((service) => service.name), ["Barba"]);

  const all = await listServices({ tenantId: "t1", repository, includeInactive: true });
  assert.equal(all.services.length, 2);
  assert.equal(all.services.some((service) => service.active === false), true);
});

test("servicios activos para el agente: filtro, límite y exclusión de inactivos", async () => {
  const repository = createFakeRepository();
  const first = await createService({ tenantId: "t1", body: VALID_BODY, repository });
  await createService({ tenantId: "t1", body: { ...VALID_BODY, name: "Barba", category: "Barba" }, repository });
  await deactivateService({ tenantId: "t1", serviceId: first.service.serviceId, repository });

  const result = await listActiveServices({ tenantId: "t1", repository });
  assert.equal(result.services.length, 1);
  assert.equal(result.services[0].name, "Barba");

  const byQuery = await listActiveServices({ tenantId: "t1", repository, query: "barba" });
  assert.equal(byQuery.services.length, 1);

  const noMatches = await listActiveServices({ tenantId: "t1", repository, query: "tinte" });
  assert.deepEqual(noMatches.services, []);

  const limited = await listActiveServices({ tenantId: "t1", repository, limit: 0 });
  assert.deepEqual(limited.services, []);
});

test("getActiveService devuelve null si no existe o está inactivo", async () => {
  const repository = createFakeRepository();
  const created = await createService({ tenantId: "t1", body: VALID_BODY, repository });
  const active = await getActiveService({ tenantId: "t1", serviceId: created.service.serviceId, repository });
  assert.equal(active.name, "Corte clásico");

  await deactivateService({ tenantId: "t1", serviceId: created.service.serviceId, repository });
  assert.equal(await getActiveService({ tenantId: "t1", serviceId: created.service.serviceId, repository }), null);
  assert.equal(await getActiveService({ tenantId: "t1", serviceId: "svc_999", repository }), null);
  assert.equal(await getActiveService({ tenantId: "t1", serviceId: "mal id", repository }), null);
});

test("normaliza nombres e ids", () => {
  assert.equal(normalizeServiceName("  Corte  Clásico "), "corte clasico");
  assert.equal(normalizeServiceName(null), "");
  assert.equal(isValidServiceId("abc_123-XYZ"), true);
  assert.equal(isValidServiceId("id con espacios"), false);
  assert.equal(isValidServiceId(""), false);
});

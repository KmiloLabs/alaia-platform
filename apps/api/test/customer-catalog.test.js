import test from "node:test";
import assert from "node:assert/strict";
import {
  createCustomer,
  deactivateCustomer,
  findCustomerByPhone,
  getCustomer,
  listCustomers,
  normalizeCustomerPhone,
  searchActiveCustomers,
  updateCustomer,
  validateCustomerInput,
} from "../src/customer-catalog.js";

function createFakeRepository() {
  const docs = new Map();
  let counter = 0;
  return {
    docs,
    async list() {
      return [...docs.entries()].map(([customerId, data]) => ({ customerId, data }));
    },
    async get(_tenantId, customerId) {
      return docs.has(customerId) ? { customerId, data: docs.get(customerId) } : null;
    },
    async findByPhone(_tenantId, phone) {
      for (const [customerId, data] of docs.entries()) {
        if (data.phone === phone) return { customerId, data };
      }
      return null;
    },
    async create(_tenantId, data) {
      counter += 1;
      const customerId = `cus_${counter}`;
      const now = new Date(2026, 0, 1, 0, counter);
      docs.set(customerId, { ...data, id: customerId, createdAt: now, updatedAt: now });
      return { customerId, data: docs.get(customerId) };
    },
    async update(_tenantId, customerId, data) {
      const updated = { ...docs.get(customerId), ...data, updatedAt: new Date(2026, 0, 2, 0, counter) };
      docs.set(customerId, updated);
      return { customerId, data: updated };
    },
  };
}

const VALID_BODY = {
  name: "Camila Rojas",
  phone: "300 123 4567",
  email: "camila@example.com",
  notes: "Prefiere mañanas",
};

test("valida el alta de clientes y aplica defaults", () => {
  const result = validateCustomerInput(VALID_BODY);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    name: "Camila Rojas",
    phone: "3001234567",
    email: "camila@example.com",
    notes: "Prefiere mañanas",
  });

  const minimal = validateCustomerInput({ name: "Cliente" });
  assert.equal(minimal.ok, true);
  assert.deepEqual(minimal.value, { name: "Cliente", phone: "", email: "", notes: "" });

  const partial = validateCustomerInput({ notes: "Solo notas" }, { partial: true });
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.value, { notes: "Solo notas" });
});

test("normaliza el teléfono quitando todo lo que no sea dígito", () => {
  assert.equal(normalizeCustomerPhone("300 123 4567"), "3001234567");
  assert.equal(normalizeCustomerPhone("+57 (300) 123-4567"), "573001234567");
  assert.equal(normalizeCustomerPhone("3001234567"), "3001234567");
  assert.equal(normalizeCustomerPhone("123456"), null);
  assert.equal(normalizeCustomerPhone("1234567890123456"), null);
  assert.equal(normalizeCustomerPhone(""), null);
  assert.equal(normalizeCustomerPhone(null), null);
});

test("códigos de error de validación de clientes", () => {
  const cases = [
    ["invalid_customer_name", { name: "A" }],
    ["invalid_customer_name", { name: "x".repeat(81) }],
    ["invalid_customer_name", {}],
    ["invalid_customer_phone", { name: "Cliente", phone: "12345" }],
    ["invalid_customer_phone", { name: "Cliente", phone: "1234567890123456" }],
    ["invalid_customer_phone", { name: "Cliente", phone: 3001234567 }],
    ["invalid_customer_email", { name: "Cliente", email: "sin-arroba" }],
    ["invalid_customer_email", { name: "Cliente", email: "x".repeat(121) }],
    ["invalid_customer_email", { name: "Cliente", email: 42 }],
    ["invalid_customer_notes", { name: "Cliente", notes: "x".repeat(301) }],
    ["invalid_customer_notes", { name: "Cliente", notes: 42 }],
  ];
  for (const [code, body] of cases) {
    const result = validateCustomerInput(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, code, JSON.stringify(body));
  }
});

test("crea un cliente activo con teléfono normalizado", async () => {
  const repository = createFakeRepository();
  const result = await createCustomer({ tenantId: "t1", body: VALID_BODY, repository });
  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
  assert.equal(result.customer.customerId, "cus_1");
  assert.equal(result.customer.id, "cus_1");
  assert.equal(result.customer.name, "Camila Rojas");
  assert.equal(result.customer.phone, "3001234567");
  assert.equal(result.customer.active, true);
  assert.equal(typeof result.customer.createdAt, "string");
});

test("teléfono duplicado en el negocio devuelve 409 (incluye inactivos)", async () => {
  const repository = createFakeRepository();
  const created = await createCustomer({ tenantId: "t1", body: VALID_BODY, repository });

  const duplicate = await createCustomer({
    tenantId: "t1",
    body: { name: "Otra persona", phone: "300 123 4567" },
    repository,
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.code, "customer_phone_taken");

  await deactivateCustomer({ tenantId: "t1", customerId: created.customer.customerId, repository });
  const duplicateInactive = await createCustomer({
    tenantId: "t1",
    body: { name: "Otra persona", phone: "3001234567" },
    repository,
  });
  assert.equal(duplicateInactive.ok, false);
  assert.equal(duplicateInactive.code, "customer_phone_taken");

  const withoutPhoneA = await createCustomer({ tenantId: "t1", body: { name: "Mostrador 1" }, repository });
  const withoutPhoneB = await createCustomer({ tenantId: "t1", body: { name: "Mostrador 2" }, repository });
  assert.equal(withoutPhoneA.ok, true);
  assert.equal(withoutPhoneB.ok, true);
});

test("actualiza datos y evita teléfonos duplicados", async () => {
  const repository = createFakeRepository();
  const first = await createCustomer({ tenantId: "t1", body: VALID_BODY, repository });
  await createCustomer({ tenantId: "t1", body: { name: "Otro", phone: "3111111111" }, repository });

  const updated = await updateCustomer({
    tenantId: "t1",
    customerId: first.customer.customerId,
    body: { email: "nuevo@example.com", notes: "Actualizado" },
    repository,
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.customer.email, "nuevo@example.com");
  assert.equal(updated.customer.notes, "Actualizado");
  assert.equal(updated.customer.phone, "3001234567");

  const duplicate = await updateCustomer({
    tenantId: "t1",
    customerId: first.customer.customerId,
    body: { phone: "3111111111" },
    repository,
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, "customer_phone_taken");

  const samePhone = await updateCustomer({
    tenantId: "t1",
    customerId: first.customer.customerId,
    body: { phone: "300 123 4567" },
    repository,
  });
  assert.equal(samePhone.ok, true);

  const missing = await updateCustomer({ tenantId: "t1", customerId: "cus_999", body: { notes: "x" }, repository });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "customer_not_found");

  const invalid = await updateCustomer({ tenantId: "t1", customerId: first.customer.customerId, body: { email: "malo" }, repository });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "invalid_customer_email");
});

test("el borrado es lógico: conserva el documento con active=false", async () => {
  const repository = createFakeRepository();
  const created = await createCustomer({ tenantId: "t1", body: VALID_BODY, repository });
  const customerId = created.customer.customerId;

  const deleted = await deactivateCustomer({ tenantId: "t1", customerId, repository });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.customer.active, false);
  assert.equal(repository.docs.has(customerId), true);
  assert.equal(repository.docs.get(customerId).active, false);

  const again = await deactivateCustomer({ tenantId: "t1", customerId, repository });
  assert.equal(again.ok, true);

  const missing = await deactivateCustomer({ tenantId: "t1", customerId: "cus_999", repository });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
});

test("lista con búsqueda por nombre o teléfono y filtro de inactivos", async () => {
  const repository = createFakeRepository();
  const camila = await createCustomer({ tenantId: "t1", body: VALID_BODY, repository });
  await createCustomer({ tenantId: "t1", body: { name: "Óscar Pérez", phone: "3111111111" }, repository });
  await deactivateCustomer({ tenantId: "t1", customerId: camila.customer.customerId, repository });

  const active = await listCustomers({ tenantId: "t1", repository });
  assert.equal(active.ok, true);
  assert.deepEqual(active.customers.map((customer) => customer.name), ["Óscar Pérez"]);
  assert.equal(active.total, 1);

  const all = await listCustomers({ tenantId: "t1", repository, includeInactive: true });
  assert.equal(all.customers.length, 2);
  assert.equal(all.total, 2);

  const byName = await listCustomers({ tenantId: "t1", repository, includeInactive: true, query: "oscar" });
  assert.deepEqual(byName.customers.map((customer) => customer.name), ["Óscar Pérez"]);

  const byPhone = await listCustomers({ tenantId: "t1", repository, includeInactive: true, query: "300 123" });
  assert.deepEqual(byPhone.customers.map((customer) => customer.name), ["Camila Rojas"]);
});

test("búsqueda del agente: solo activos, máximo 10 y query obligatoria", async () => {
  const repository = createFakeRepository();
  await createCustomer({ tenantId: "t1", body: VALID_BODY, repository });
  const inactive = await createCustomer({ tenantId: "t1", body: { name: "Inactivo", phone: "3222222222" }, repository });
  await deactivateCustomer({ tenantId: "t1", customerId: inactive.customer.customerId, repository });

  const result = await searchActiveCustomers({ tenantId: "t1", query: "camila", repository });
  assert.equal(result.customers.length, 1);
  assert.equal(result.customers[0].name, "Camila Rojas");

  const inactiveSearch = await searchActiveCustomers({ tenantId: "t1", query: "inactivo", repository });
  assert.deepEqual(inactiveSearch.customers, []);

  const empty = await searchActiveCustomers({ tenantId: "t1", query: "", repository });
  assert.deepEqual(empty.customers, []);

  const byPhone = await searchActiveCustomers({ tenantId: "t1", query: "3001234567", repository });
  assert.equal(byPhone.customers[0].name, "Camila Rojas");
});

test("findCustomerByPhone y getCustomer", async () => {
  const repository = createFakeRepository();
  const created = await createCustomer({ tenantId: "t1", body: VALID_BODY, repository });

  const found = await findCustomerByPhone({ tenantId: "t1", phone: "300 123 4567", repository });
  assert.equal(found.name, "Camila Rojas");
  assert.equal(await findCustomerByPhone({ tenantId: "t1", phone: "123", repository }), null);
  assert.equal(await findCustomerByPhone({ tenantId: "t1", phone: "3999999999", repository }), null);

  const customer = await getCustomer({ tenantId: "t1", customerId: created.customer.customerId, repository });
  assert.equal(customer.name, "Camila Rojas");
  assert.equal(await getCustomer({ tenantId: "t1", customerId: "id con espacios", repository }), null);
  assert.equal(await getCustomer({ tenantId: "t1", customerId: "cus_999", repository }), null);
});

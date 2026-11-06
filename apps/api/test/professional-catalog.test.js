import test from "node:test";
import assert from "node:assert/strict";
import {
  createProfessional,
  deactivateProfessional,
  getProfessional,
  listProfessionals,
  normalizeProfessionalName,
  normalizeProfessionalPhone,
  serializeCommission,
  updateProfessional,
  validateProfessionalInput,
} from "../src/professional-catalog.js";

function createFakeRepository() {
  const docs = new Map();
  let counter = 0;
  return {
    docs,
    async list() {
      return [...docs.entries()].map(([professionalId, data]) => ({ professionalId, data }));
    },
    async get(_tenantId, professionalId) {
      return docs.has(professionalId) ? { professionalId, data: docs.get(professionalId) } : null;
    },
    async create(_tenantId, data) {
      counter += 1;
      const professionalId = `pro_${counter}`;
      const now = new Date(2026, 0, 1, 0, counter);
      docs.set(professionalId, { ...data, id: professionalId, createdAt: now, updatedAt: now });
      return { professionalId, data: docs.get(professionalId) };
    },
    async update(_tenantId, professionalId, data) {
      const updated = { ...docs.get(professionalId), ...data, updatedAt: new Date(2026, 0, 2, 0, counter) };
      docs.set(professionalId, updated);
      return { professionalId, data: updated };
    },
  };
}

const PERCENTAGE_BODY = {
  name: "Andrés",
  phone: "300 123 4567",
  email: "andres@example.com",
  notes: "Barbero principal",
  commission: { type: "percentage", percent: 50, amountCOP: 0, rentCOP: 0, effectiveFrom: "2026-11-06" },
};

test("valida un profesional completo y normaliza el teléfono", () => {
  const result = validateProfessionalInput(PERCENTAGE_BODY);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    name: "Andrés",
    phone: "3001234567",
    email: "andres@example.com",
    notes: "Barbero principal",
    commission: { type: "percentage", percent: 50, amountCOP: 0, rentCOP: 0, effectiveFrom: "2026-11-06" },
  });
});

test("comisión por defecto y campos opcionales vacíos", () => {
  const result = validateProfessionalInput({ name: "Andrés" }, { defaultEffectiveFrom: "2026-11-06" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    name: "Andrés",
    phone: "",
    email: "",
    notes: "",
    commission: { type: "percentage", percent: 0, amountCOP: 0, rentCOP: 0, effectiveFrom: "2026-11-06" },
  });

  const fixed = validateProfessionalInput({ name: "Ana", commission: { type: "fixed", amountCOP: 15000 } }, { defaultEffectiveFrom: "2026-11-06" });
  assert.equal(fixed.ok, true);
  assert.deepEqual(fixed.value.commission, { type: "fixed", percent: 0, amountCOP: 15000, rentCOP: 0, effectiveFrom: "2026-11-06" });

  const rent = validateProfessionalInput({ name: "Ana", commission: { type: "rent", rentCOP: 300000 } }, { defaultEffectiveFrom: "2026-11-06" });
  assert.equal(rent.ok, true);
  assert.equal(rent.value.commission.rentCOP, 300000);

  const mixed = validateProfessionalInput({ name: "Ana", commission: { type: "mixed", percent: 40, rentCOP: 100000 } }, { defaultEffectiveFrom: "2026-11-06" });
  assert.equal(mixed.ok, true);
  assert.deepEqual(mixed.value.commission, { type: "mixed", percent: 40, amountCOP: 0, rentCOP: 100000, effectiveFrom: "2026-11-06" });
});

test("códigos de error de validación de profesionales", () => {
  const cases = [
    ["invalid_professional_name", { name: "A" }],
    ["invalid_professional_name", { name: "x".repeat(81) }],
    ["invalid_professional_phone", { name: "Ana", phone: "12345" }],
    ["invalid_professional_phone", { name: "Ana", phone: "1234567890123456" }],
    ["invalid_professional_phone", { name: "Ana", phone: 3001234567 }],
    ["invalid_professional_email", { name: "Ana", email: "sin-arroba" }],
    ["invalid_professional_email", { name: "Ana", email: "x".repeat(121) }],
    ["invalid_professional_notes", { name: "Ana", notes: "x".repeat(201) }],
  ];
  for (const [code, body] of cases) {
    const result = validateProfessionalInput(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, code, JSON.stringify(body));
  }
});

test("códigos de error de la comisión", () => {
  const commissionCases = [
    ["invalid_commission_type", { type: "inventado" }],
    ["invalid_commission_type", {}],
    ["invalid_percent", { type: "percentage" }],
    ["invalid_percent", { type: "percentage", percent: 101 }],
    ["invalid_percent", { type: "percentage", percent: 50.5 }],
    ["invalid_percent", { type: "mixed", rentCOP: 1000 }],
    ["invalid_amount", { type: "fixed" }],
    ["invalid_amount", { type: "fixed", amountCOP: -1 }],
    ["invalid_amount", { type: "fixed", amountCOP: 10_000_001 }],
    ["invalid_rent", { type: "rent" }],
    ["invalid_rent", { type: "rent", rentCOP: -5 }],
    ["invalid_rent", { type: "mixed", percent: 20 }],
    ["invalid_effective_from", { type: "percentage", percent: 10, effectiveFrom: "2026-02-30" }],
    ["invalid_effective_from", { type: "percentage", percent: 10, effectiveFrom: "06/11/2026" }],
  ];
  for (const [code, commission] of commissionCases) {
    const result = validateProfessionalInput({ name: "Ana", commission }, { defaultEffectiveFrom: "2026-11-06" });
    assert.equal(result.ok, false, JSON.stringify(commission));
    assert.equal(result.code, code, JSON.stringify(commission));
  }

  const withoutEffective = validateProfessionalInput(
    { name: "Ana", commission: { type: "percentage", percent: 10 } },
    { defaultEffectiveFrom: null },
  );
  assert.equal(withoutEffective.ok, false);
  assert.equal(withoutEffective.code, "invalid_effective_from");
});

test("crea un profesional activo con comisión anidada", async () => {
  const repository = createFakeRepository();
  const result = await createProfessional({ tenantId: "t1", body: PERCENTAGE_BODY, repository });
  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
  assert.equal(result.professional.professionalId, "pro_1");
  assert.equal(result.professional.id, "pro_1");
  assert.equal(result.professional.name, "Andrés");
  assert.equal(result.professional.phone, "3001234567");
  assert.equal(result.professional.active, true);
  assert.equal(result.professional.commission.type, "percentage");
  assert.equal(result.professional.commission.percent, 50);
  assert.equal(typeof result.professional.createdAt, "string");
});

test("nombre único sin distinguir mayúsculas, espacios ni acentos", async () => {
  const repository = createFakeRepository();
  await createProfessional({ tenantId: "t1", body: PERCENTAGE_BODY, repository });

  for (const name of ["ANDRÉS", "andres", "  Andrés  "]) {
    const duplicate = await createProfessional({ tenantId: "t1", body: { ...PERCENTAGE_BODY, name }, repository });
    assert.equal(duplicate.ok, false, name);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.code, "professional_name_taken");
  }

  const other = await createProfessional({ tenantId: "t1", body: { ...PERCENTAGE_BODY, name: "Camila" }, repository });
  assert.equal(other.ok, true);
});

test("actualiza datos y evita nombres duplicados", async () => {
  const repository = createFakeRepository();
  const first = await createProfessional({ tenantId: "t1", body: PERCENTAGE_BODY, repository });
  await createProfessional({ tenantId: "t1", body: { ...PERCENTAGE_BODY, name: "Camila" }, repository });

  const updated = await updateProfessional({
    tenantId: "t1",
    professionalId: first.professional.professionalId,
    body: { notes: "Actualizado", commission: { type: "fixed", amountCOP: 20000 } },
    defaultEffectiveFrom: "2026-11-06",
    repository,
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.professional.notes, "Actualizado");
  assert.equal(updated.professional.commission.type, "fixed");
  assert.equal(updated.professional.commission.amountCOP, 20000);

  const duplicate = await updateProfessional({
    tenantId: "t1",
    professionalId: first.professional.professionalId,
    body: { name: "camila" },
    repository,
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, "professional_name_taken");

  const sameName = await updateProfessional({
    tenantId: "t1",
    professionalId: first.professional.professionalId,
    body: { name: "ANDRÉS" },
    repository,
  });
  assert.equal(sameName.ok, true);

  const missing = await updateProfessional({ tenantId: "t1", professionalId: "pro_999", body: { notes: "x" }, repository });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "professional_not_found");

  const invalid = await updateProfessional({
    tenantId: "t1",
    professionalId: first.professional.professionalId,
    body: { email: "malo" },
    repository,
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "invalid_professional_email");
});

test("el borrado es lógico y la lista filtra inactivos", async () => {
  const repository = createFakeRepository();
  const created = await createProfessional({ tenantId: "t1", body: PERCENTAGE_BODY, repository });
  await createProfessional({ tenantId: "t1", body: { ...PERCENTAGE_BODY, name: "Camila" }, repository });

  const deleted = await deactivateProfessional({ tenantId: "t1", professionalId: created.professional.professionalId, repository });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.professional.active, false);
  assert.equal(repository.docs.has(created.professional.professionalId), true);

  const again = await deactivateProfessional({ tenantId: "t1", professionalId: created.professional.professionalId, repository });
  assert.equal(again.ok, true);

  const active = await listProfessionals({ tenantId: "t1", repository });
  assert.equal(active.total, 1);
  assert.deepEqual(active.professionals.map((professional) => professional.name), ["Camila"]);

  const all = await listProfessionals({ tenantId: "t1", includeInactive: true, repository });
  assert.equal(all.total, 2);

  const missing = await deactivateProfessional({ tenantId: "t1", professionalId: "pro_999", repository });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
});

test("getProfessional valida id y devuelve null si no existe", async () => {
  const repository = createFakeRepository();
  const created = await createProfessional({ tenantId: "t1", body: PERCENTAGE_BODY, repository });
  const found = await getProfessional({ tenantId: "t1", professionalId: created.professional.professionalId, repository });
  assert.equal(found.name, "Andrés");
  assert.equal(await getProfessional({ tenantId: "t1", professionalId: "id con espacios", repository }), null);
  assert.equal(await getProfessional({ tenantId: "t1", professionalId: "pro_999", repository }), null);
});

test("normalización y serialización de comisión", () => {
  assert.equal(normalizeProfessionalName("  Óscar  Pérez "), "oscar perez");
  assert.equal(normalizeProfessionalPhone("+57 300 123 4567"), "573001234567");
  assert.equal(normalizeProfessionalPhone("123"), null);
  assert.deepEqual(serializeCommission(undefined), {
    type: "percentage",
    percent: 0,
    amountCOP: 0,
    rentCOP: 0,
    effectiveFrom: null,
  });
});

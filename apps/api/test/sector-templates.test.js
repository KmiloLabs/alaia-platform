import { test } from "node:test";
import assert from "node:assert/strict";
import { SECTOR_TEMPLATES, sectorTemplateFor } from "../src/sector-templates.js";

const sectors = Object.keys(SECTOR_TEMPLATES);

test("cada sector tiene una plantilla con al menos un servicio", () => {
  for (const sector of sectors) {
    const template = sectorTemplateFor(sector);
    assert.ok(template.length >= 1, `${sector} no tiene servicios`);
  }
});

test("los servicios de la plantilla son válidos y tienen nombre único", () => {
  for (const sector of sectors) {
    const names = new Set();
    for (const service of sectorTemplateFor(sector)) {
      assert.ok(service.name.length >= 2 && service.name.length <= 80, `${sector}: nombre inválido ${service.name}`);
      assert.equal(service.name.trim(), service.name, `${sector}: nombre con espacios`);
      assert.ok(Number.isInteger(service.durationMinutes) && service.durationMinutes >= 5 && service.durationMinutes <= 480, `${sector}: duración inválida`);
      assert.ok(Number.isInteger(service.priceCOP) && service.priceCOP >= 0 && service.priceCOP <= 10000000, `${sector}: precio inválido`);
      const key = service.name.toLowerCase();
      assert.ok(!names.has(key), `${sector}: nombre repetido ${service.name}`);
      names.add(key);
    }
  }
});

test("un sector desconocido no devuelve servicios", () => {
  assert.deepEqual(sectorTemplateFor("inexistente"), []);
  assert.deepEqual(sectorTemplateFor(undefined), []);
});

test("la plantilla devuelve copias y no se puede mutar la original", () => {
  const first = sectorTemplateFor("barberia");
  first[0].priceCOP = 1;
  const second = sectorTemplateFor("barberia");
  assert.notEqual(second[0].priceCOP, 1);
});

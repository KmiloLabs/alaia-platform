import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OPENING_HOURS } from "../src/availability.js";
import { buildAgentSystemPrompt, formatHumanDateTime, formatOpeningHours } from "../src/agent/prompts.js";

const TENANT = {
  id: "tenant-1",
  name: "Araan Barbería",
  timeZone: "America/Bogota",
  openingHours: DEFAULT_OPENING_HOURS,
};

test("el prompt incluye el contexto real del negocio", () => {
  const prompt = buildAgentSystemPrompt({
    tenant: TENANT,
    config: { provider: "mock", model: "mock-agent", tone: "formal", instructions: "No agendamos los domingos." },
    now: new Date("2030-03-15T15:00:00.000Z"),
  });

  assert.match(prompt, /Araan Barbería/);
  assert.match(prompt, /America\/Bogota/);
  assert.match(prompt, /2030-03-15/);
  assert.match(prompt, /10:00/);
  assert.match(prompt, /lunes 09:00-18:00/);
  assert.match(prompt, /domingo cerrado/);
  assert.match(prompt, /formal/);
  assert.match(prompt, /No agendamos los domingos\./);
  assert.match(prompt, /JSON/);
  assert.match(prompt, /reply/);
  assert.match(prompt, /action/);
  assert.match(prompt, /No inventes precios, horarios, disponibilidad ni historial/);
  assert.match(prompt, /confirmación explícita/);
  assert.doesNotMatch(prompt, /clínica|dental|doctora/i);
});

test("usa los valores por defecto cuando faltan tono e instrucciones", () => {
  const prompt = buildAgentSystemPrompt({ tenant: TENANT, config: {} });
  assert.match(prompt, /cercano/);
  assert.match(prompt, /\(sin instrucciones adicionales\)/);
});

test("respeta un horario de atención personalizado", () => {
  const prompt = buildAgentSystemPrompt({
    tenant: { ...TENANT, openingHours: [{ day: 3, open: "10:00", close: "14:00" }] },
    config: {},
  });
  assert.match(prompt, /miércoles 10:00-14:00/);
  assert.match(prompt, /lunes cerrado/);
});

test("cae en America/Bogota si el tenant no tiene zona válida", () => {
  const prompt = buildAgentSystemPrompt({ tenant: { ...TENANT, timeZone: "No/Existe" }, config: {} });
  assert.match(prompt, /America\/Bogota/);
});

test("formatOpeningHours agrupa tramos del mismo día", () => {
  assert.equal(
    formatOpeningHours([
      { day: 1, open: "09:00", close: "12:00" },
      { day: 1, open: "14:00", close: "18:00" },
      { day: 2, open: "09:00", close: "18:00" },
    ]),
    "lunes 09:00-12:00 y 14:00-18:00; martes 09:00-18:00; miércoles cerrado; jueves cerrado; viernes cerrado; sábado cerrado; domingo cerrado",
  );
});

test("formatHumanDateTime usa la zona del negocio", () => {
  const formatted = formatHumanDateTime(new Date("2030-03-15T15:00:00.000Z"), "America/Bogota");
  assert.match(formatted, /2030/);
  assert.match(formatted, /10:00/);
});

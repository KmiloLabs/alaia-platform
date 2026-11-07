import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_REMINDER_VARIABLES,
  DEFAULT_REMINDERS,
  DEFAULT_REMINDER_MESSAGE,
  computeReminderSchedule,
  renderReminderMessage,
  reminderMessageVariables,
  resolveReminders,
  validateReminders,
} from "../src/reminder-config.js";

const NOW = new Date("2026-11-06T15:00:00.000Z");
const MESSAGE = "Hola {nombre}, te esperamos en {negocio} el {fecha} a las {hora} para {servicio}.";

test("configuración por defecto y tolerante al leer", () => {
  assert.deepEqual(resolveReminders({}), DEFAULT_REMINDERS);
  assert.deepEqual(resolveReminders(null), DEFAULT_REMINDERS);
  assert.equal(DEFAULT_REMINDERS.enabled, false);
  assert.equal(DEFAULT_REMINDERS.firstHoursBefore, 24);
  assert.equal(DEFAULT_REMINDERS.secondHoursBefore, 2);
  assert.equal(DEFAULT_REMINDER_MESSAGE.includes("{nombre}"), true);

  assert.deepEqual(resolveReminders({
    reminders: { enabled: true, firstHoursBefore: 48, secondHoursBefore: 0, message: MESSAGE },
  }), { enabled: true, firstHoursBefore: 48, secondHoursBefore: 0, message: MESSAGE });

  // Valores inválidos guardados caen a defaults sin romper.
  assert.deepEqual(resolveReminders({
    reminders: { enabled: "si", firstHoursBefore: 500, secondHoursBefore: -1, message: "x".repeat(301) },
  }), DEFAULT_REMINDERS);
});

test("valida la configuración de recordatorios", () => {
  const valid = validateReminders({
    reminders: { enabled: true, firstHoursBefore: 24, secondHoursBefore: 2, message: MESSAGE },
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, { enabled: true, firstHoursBefore: 24, secondHoursBefore: 2, message: MESSAGE });

  // Parcial: rellena defaults.
  const partial = validateReminders({ reminders: { enabled: true } });
  assert.equal(partial.ok, true);
  assert.equal(partial.value.firstHoursBefore, 24);
  assert.equal(partial.value.secondHoursBefore, 2);
  assert.equal(partial.value.message, DEFAULT_REMINDER_MESSAGE);

  // Desactivado con ambos 0 es válido.
  const disabled = validateReminders({ reminders: { enabled: false, firstHoursBefore: 0, secondHoursBefore: 0 } });
  assert.equal(disabled.ok, true);

  const cases = [
    ["invalid_reminders", { reminders: "no-es-objeto" }],
    ["invalid_reminders", { reminders: { enabled: "si" } }],
    ["invalid_reminders", { reminders: { firstHoursBefore: 169 } }],
    ["invalid_reminders", { reminders: { secondHoursBefore: -1 } }],
    ["invalid_reminders", { reminders: { firstHoursBefore: 2.5 } }],
    ["invalid_reminder_schedule", { reminders: { enabled: true, firstHoursBefore: 0, secondHoursBefore: 0 } }],
    ["invalid_reminder_message", { reminders: { message: "x".repeat(301) } }],
    ["invalid_reminder_message", { reminders: { message: "Hola {otro}" } }],
    ["invalid_reminder_message", { reminders: { message: 42 } }],
    ["invalid_reminder_message", { reminders: { message: "   " } }],
  ];
  for (const [code, body] of cases) {
    const result = validateReminders(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, code, JSON.stringify(body));
  }

  // Todas las variables permitidas pasan.
  const allowed = ALLOWED_REMINDER_VARIABLES.map((name) => `{${name}}`).join(" ");
  assert.equal(validateReminders({ reminders: { message: allowed } }).ok, true);
});

test("cálculo de sendAt: cita a 2 días genera 24 h y 2 h", () => {
  const startsAt = new Date(NOW.getTime() + 48 * 60 * 60 * 1000);
  const schedule = computeReminderSchedule({
    reminders: { enabled: true, firstHoursBefore: 24, secondHoursBefore: 2 },
    startsAt,
    now: NOW,
  });
  assert.deepEqual(schedule, [
    { kind: "first", sendAt: new Date(startsAt.getTime() - 24 * 60 * 60 * 1000) },
    { kind: "second", sendAt: new Date(startsAt.getTime() - 2 * 60 * 60 * 1000) },
  ]);
});

test("cita a 3 horas solo programa el aviso de 2 h", () => {
  const startsAt = new Date(NOW.getTime() + 3 * 60 * 60 * 1000);
  const schedule = computeReminderSchedule({
    reminders: { enabled: true, firstHoursBefore: 24, secondHoursBefore: 2 },
    startsAt,
    now: NOW,
  });
  assert.deepEqual(schedule, [{ kind: "second", sendAt: new Date(NOW.getTime() + 1 * 60 * 60 * 1000) }]);
});

test("no programa avisos pasados, citas pasadas ni desactivados", () => {
  const inMinutes = new Date(NOW.getTime() + 30 * 60 * 1000);
  assert.deepEqual(computeReminderSchedule({
    reminders: { enabled: true, firstHoursBefore: 24, secondHoursBefore: 2 },
    startsAt: inMinutes,
    now: NOW,
  }), []);

  assert.deepEqual(computeReminderSchedule({
    reminders: { enabled: true, firstHoursBefore: 24, secondHoursBefore: 2 },
    startsAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    now: NOW,
  }), []);

  const twoDays = new Date(NOW.getTime() + 48 * 60 * 60 * 1000);
  assert.deepEqual(computeReminderSchedule({
    reminders: { enabled: false, firstHoursBefore: 24, secondHoursBefore: 2 },
    startsAt: twoDays,
    now: NOW,
  }), []);

  // Avisos en 0 se omiten.
  assert.deepEqual(computeReminderSchedule({
    reminders: { enabled: true, firstHoursBefore: 0, secondHoursBefore: 2 },
    startsAt: twoDays,
    now: NOW,
  }), [{ kind: "second", sendAt: new Date(twoDays.getTime() - 2 * 60 * 60 * 1000) }]);
});

test("interpolación del mensaje con las variables permitidas", () => {
  const variables = reminderMessageVariables({
    tenantName: "Araan Barbería",
    appointment: {
      customerName: "Camila",
      startsAtLocal: "2026-11-20T10:30",
      serviceName: "Corte clásico",
    },
  });
  assert.deepEqual(variables, {
    nombre: "Camila",
    negocio: "Araan Barbería",
    fecha: "2026-11-20",
    hora: "10:30",
    servicio: "Corte clásico",
  });
  assert.equal(
    renderReminderMessage(MESSAGE, variables),
    "Hola Camila, te esperamos en Araan Barbería el 2026-11-20 a las 10:30 para Corte clásico.",
  );
  assert.equal(renderReminderMessage("Hola {nombre} {desconocida}", { nombre: "Ana" }), "Hola Ana {desconocida}");
});

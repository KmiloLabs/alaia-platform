import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OPENING_HOURS } from "../src/availability.js";
import { AGENT_TOOLS, executeTool } from "../src/agent/tools.js";

const TENANT = {
  id: "tenant-1",
  name: "Araan Barbería",
  timeZone: "America/Bogota",
  openingHours: DEFAULT_OPENING_HOURS,
};
const CONTEXT = { tenant: TENANT, actorUid: "uid-1", conversationId: "conv-1" };
const NOW = new Date("2030-03-15T15:00:00.000Z"); // 10:00 en Bogotá

function fakeDeps(overrides = {}) {
  const calls = { availability: [], list: [], create: [], reschedule: [], cancel: [] };
  const deps = {
    now: () => NOW,
    getAvailability: async (args) => {
      calls.availability.push(args);
      return {
        ok: true,
        timeZone: "America/Bogota",
        durationMinutes: 45,
        stepMinutes: 30,
        slots: Array.from({ length: 20 }, (_, index) => ({
          startsAt: `2030-03-${String(16 + Math.floor(index / 18)).padStart(2, "0")}T14:00:00.000Z`,
          startsAtLocal: `2030-03-16T09:${String(index % 60).padStart(2, "0")}`,
        })),
      };
    },
    listAppointments: async (args) => {
      calls.list.push(args);
      return {
        ok: true,
        appointments: Array.from({ length: 25 }, (_, index) => ({
          appointmentId: `appt_${index}`,
          customerName: `Cliente ${index}`,
          serviceName: "Corte",
          startsAtLocal: "2030-03-16T09:00",
          durationMinutes: 45,
          status: "scheduled",
        })),
      };
    },
    createAppointment: async (args) => {
      calls.create.push(args);
      return {
        ok: true,
        created: true,
        appointment: { appointmentId: "appt_nueva", startsAtLocal: "2030-03-20T10:00" },
      };
    },
    rescheduleAppointment: async (args) => {
      calls.reschedule.push(args);
      return { ok: true, appointment: { appointmentId: args.appointmentId, startsAtLocal: "2030-03-21T09:00" } };
    },
    cancelAppointment: async (args) => {
      calls.cancel.push(args);
      return { ok: true, appointment: { appointmentId: args.appointmentId, status: "cancelled" } };
    },
    ...overrides,
  };
  return { deps, calls };
}

test("se registran las seis herramientas del contrato", () => {
  assert.deepEqual(AGENT_TOOLS.map((tool) => tool.name), [
    "consultar_disponibilidad",
    "consultar_agenda",
    "crear_cita",
    "reprogramar_cita",
    "cancelar_cita",
    "derivar_a_persona",
  ]);
  for (const tool of AGENT_TOOLS) {
    assert.equal(typeof tool.description, "string");
    assert.equal(tool.parameters.type, "object");
  }
});

test("herramienta desconocida devuelve unknown_tool", async () => {
  const result = await executeTool("borrar_todo", {}, CONTEXT, fakeDeps().deps);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "unknown_tool");
});

test("consultar_disponibilidad usa el tenant del contexto y un rango por defecto", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("consultar_disponibilidad", {}, CONTEXT, deps);

  assert.equal(result.ok, true);
  assert.equal(calls.availability.length, 1);
  assert.equal(calls.availability[0].tenant.id, "tenant-1");
  assert.deepEqual(calls.availability[0].query, { from: "2030-03-15", to: "2030-03-21", durationMinutes: 45 });
  assert.equal(result.data.count, 20);
  assert.equal(result.data.slots.length, 12);
});

test("consultar_disponibilidad valida fechas, duración y paso", async () => {
  const { deps } = fakeDeps();
  for (const args of [
    { from: "no-es-fecha" },
    { to: "2030-02-30" },
    { durationMinutes: 4 },
    { durationMinutes: "45" },
    { stepMinutes: 241 },
  ]) {
    const result = await executeTool("consultar_disponibilidad", args, CONTEXT, deps);
    assert.equal(result.ok, false, JSON.stringify(args));
    assert.equal(result.error.code, "invalid_arguments");
  }
});

test("consultar_agenda devuelve como máximo 20 citas", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("consultar_agenda", { from: "2030-03-16", to: "2030-03-16" }, CONTEXT, deps);
  assert.equal(result.ok, true);
  assert.equal(calls.list[0].tenantId, "tenant-1");
  assert.deepEqual(calls.list[0].query, { from: "2030-03-16", to: "2030-03-16" });
  assert.equal(result.data.count, 25);
  assert.equal(result.data.appointments.length, 20);
});

test("crear_cita usa el tenant del contexto e idempotencia derivada de la conversación", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("crear_cita", {
    customerName: "  Ana Pérez ",
    serviceName: "Corte clásico",
    startsAt: "2030-03-20T10:00",
    customerPhone: "300 000 0000",
    tenantId: "otro-tenant",
  }, CONTEXT, deps);

  assert.equal(result.ok, true);
  assert.equal(result.data.appointment.appointmentId, "appt_nueva");
  const request = calls.create[0];
  assert.equal(request.tenantId, "tenant-1");
  assert.equal(request.actorUid, "uid-1");
  assert.equal(request.body.customerName, "Ana Pérez");
  assert.equal(request.body.startsAt, "2030-03-20T10:00");
  assert.equal(request.body.durationMinutes, 45);
  assert.equal(request.body.priceCOP, 0);
  assert.equal(request.body.customerPhone, "300 000 0000");
  assert.equal(request.body.clientRequestId, "agent-conv-1-2030-03-20T10:00");
});

test("crear_cita respeta clientRequestId explícito y valida argumentos", async () => {
  const { deps, calls } = fakeDeps();
  await executeTool("crear_cita", {
    customerName: "Ana",
    serviceName: "Corte",
    startsAt: "2030-03-20T10:00",
    clientRequestId: "clave-externa",
    priceCOP: 50000,
    durationMinutes: 60,
  }, CONTEXT, deps);
  assert.equal(calls.create[0].body.clientRequestId, "clave-externa");
  assert.equal(calls.create[0].body.priceCOP, 50000);
  assert.equal(calls.create[0].body.durationMinutes, 60);

  for (const args of [
    { serviceName: "Corte", startsAt: "2030-03-20T10:00" },
    { customerName: "A", serviceName: "Corte", startsAt: "2030-03-20T10:00" },
    { customerName: "Ana", serviceName: "Corte" },
    { customerName: "Ana", serviceName: "Corte", startsAt: "2030-03-20" },
    { customerName: "Ana", serviceName: "Corte", startsAt: "2030-03-20T10:00", priceCOP: 10_000_001 },
  ]) {
    const result = await executeTool("crear_cita", args, CONTEXT, deps);
    assert.equal(result.ok, false, JSON.stringify(args));
    assert.equal(result.error.code, "invalid_arguments");
  }
});

test("los errores del servicio se propagan sin inventar acciones", async () => {
  const { deps } = fakeDeps({
    createAppointment: async () => ({
      ok: false,
      status: 409,
      code: "appointment_conflict",
      message: "Ese horario se cruza con otra cita activa del negocio.",
    }),
  });
  const result = await executeTool("crear_cita", {
    customerName: "Ana",
    serviceName: "Corte",
    startsAt: "2030-03-20T10:00",
  }, CONTEXT, deps);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "appointment_conflict");
  assert.match(result.error.message, /cruza/);
});

test("reprogramar_cita y cancelar_cita usan el servicio", async () => {
  const { deps, calls } = fakeDeps();
  const moved = await executeTool("reprogramar_cita", { appointmentId: "appt_abc", startsAt: "2030-03-21T09:00", durationMinutes: 30 }, CONTEXT, deps);
  assert.equal(moved.ok, true);
  assert.equal(calls.reschedule[0].tenantId, "tenant-1");
  assert.equal(calls.reschedule[0].appointmentId, "appt_abc");
  assert.deepEqual(calls.reschedule[0].body, { startsAt: "2030-03-21T09:00", durationMinutes: 30 });

  const cancelled = await executeTool("cancelar_cita", { appointmentId: "appt_abc" }, CONTEXT, deps);
  assert.equal(cancelled.ok, true);
  assert.equal(calls.cancel[0].appointmentId, "appt_abc");

  for (const [name, args] of [
    ["reprogramar_cita", { startsAt: "2030-03-21T09:00" }],
    ["reprogramar_cita", { appointmentId: "id con espacios", startsAt: "2030-03-21T09:00" }],
    ["cancelar_cita", {}],
  ]) {
    const result = await executeTool(name, args, CONTEXT, deps);
    assert.equal(result.ok, false, JSON.stringify(args));
    assert.equal(result.error.code, "invalid_arguments");
  }
});

test("derivar_a_persona marca handoff y valida el motivo", async () => {
  const { deps } = fakeDeps();
  const result = await executeTool("derivar_a_persona", { reason: "Urgencia" }, CONTEXT, deps);
  assert.equal(result.ok, true);
  assert.equal(result.data.handoff, true);
  assert.equal(result.data.reason, "Urgencia");

  const noReason = await executeTool("derivar_a_persona", {}, CONTEXT, deps);
  assert.equal(noReason.ok, true);
  assert.equal(noReason.data.handoff, true);

  const tooLong = await executeTool("derivar_a_persona", { reason: "x".repeat(201) }, CONTEXT, deps);
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.error.code, "invalid_arguments");
});

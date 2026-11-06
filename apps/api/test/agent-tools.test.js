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
  const calls = {
    availability: [],
    list: [],
    create: [],
    reschedule: [],
    cancel: [],
    services: [],
    getService: [],
    searchCustomers: [],
    findCustomerByPhone: [],
    createCustomer: [],
  };
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
    listActiveServices: async (args) => {
      calls.services.push(args);
      return {
        ok: true,
        services: [
          { serviceId: "svc_1", name: "Corte clásico", durationMinutes: 45, priceCOP: 50000 },
          { serviceId: "svc_2", name: "Barba", durationMinutes: 30, priceCOP: 20000 },
          { serviceId: "svc_3", name: "Tinte", durationMinutes: 90, priceCOP: 120000 },
        ],
      };
    },
    getActiveService: async (args) => {
      calls.getService.push(args);
      if (args.serviceId !== "svc_activo") return null;
      return { serviceId: "svc_activo", name: "Corte del catálogo", durationMinutes: 60, priceCOP: 75000, active: true };
    },
    searchCustomers: async (args) => {
      calls.searchCustomers.push(args);
      return {
        ok: true,
        customers: [
          { customerId: "cus_1", name: "Camila Rojas", phone: "3001234567", active: true },
          { customerId: "cus_2", name: "Óscar Pérez", phone: "3111111111", active: true },
        ],
      };
    },
    findCustomerByPhone: async (args) => {
      calls.findCustomerByPhone.push(args);
      if (args.phone !== "3001234567") return null;
      return { customerId: "cus_1", name: "Camila Rojas", phone: "3001234567", active: true };
    },
    createCustomer: async (args) => {
      calls.createCustomer.push(args);
      return {
        ok: true,
        status: 201,
        customer: { customerId: "cus_nuevo", name: args.body.name, phone: args.body.phone, active: true },
      };
    },
    ...overrides,
  };
  return { deps, calls };
}

test("se registran las herramientas del contrato", () => {
  assert.deepEqual(AGENT_TOOLS.map((tool) => tool.name), [
    "consultar_disponibilidad",
    "consultar_agenda",
    "consultar_servicios",
    "buscar_cliente",
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
  assert.equal(request.body.customerPhone, "3000000000");
  assert.equal(request.body.customerId, "cus_nuevo");
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

test("consultar_servicios devuelve el catálogo activo con su tenant", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("consultar_servicios", {}, CONTEXT, deps);

  assert.equal(result.ok, true);
  assert.equal(calls.services[0].tenantId, "tenant-1");
  assert.equal(result.data.count, 3);
  assert.deepEqual(result.data.services[0], {
    id: "svc_1",
    name: "Corte clásico",
    durationMinutes: 45,
    priceCOP: 50000,
  });

  const filtered = await executeTool("consultar_servicios", { query: "barba" }, CONTEXT, deps);
  assert.equal(filtered.ok, true);
  assert.equal(calls.services[1].query, "barba");
});

test("consultar_servicios sin servicios activos devuelve lista vacía", async () => {
  const { deps } = fakeDeps({
    listActiveServices: async () => ({ ok: true, services: [] }),
  });
  const result = await executeTool("consultar_servicios", { query: "tinte" }, CONTEXT, deps);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { count: 0, services: [] });
});

test("consultar_servicios valida la query", async () => {
  const { deps } = fakeDeps();
  const tooLong = await executeTool("consultar_servicios", { query: "x".repeat(61) }, CONTEXT, deps);
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.error.code, "invalid_arguments");
});

test("crear_cita con serviceId sobrescribe nombre, duración y precio del catálogo", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("crear_cita", {
    customerName: "Ana",
    startsAt: "2030-03-20T10:00",
    serviceId: "svc_activo",
    serviceName: "Lo que diga el modelo",
    durationMinutes: 5,
    priceCOP: 1,
  }, CONTEXT, deps);

  assert.equal(result.ok, true);
  assert.equal(result.data.appointment.appointmentId, "appt_nueva");
  assert.deepEqual(calls.getService[0], { tenantId: "tenant-1", serviceId: "svc_activo" });
  assert.equal(calls.create[0].tenantId, "tenant-1");
  assert.equal(calls.create[0].body.serviceName, "Corte del catálogo");
  assert.equal(calls.create[0].body.durationMinutes, 60);
  assert.equal(calls.create[0].body.priceCOP, 75000);
});

test("crear_cita con servicio inexistente o inactivo devuelve service_not_found y no crea", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("crear_cita", {
    customerName: "Ana",
    startsAt: "2030-03-20T10:00",
    serviceId: "svc_inactivo",
  }, CONTEXT, deps);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "service_not_found");
  assert.equal(calls.create.length, 0);
});

test("crear_cita sin serviceId mantiene el comportamiento de texto libre", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("crear_cita", {
    customerName: "Ana",
    serviceName: "Servicio libre",
    startsAt: "2030-03-20T10:00",
  }, CONTEXT, deps);
  assert.equal(result.ok, true);
  assert.equal(calls.getService.length, 0);
  assert.equal(calls.create[0].body.serviceName, "Servicio libre");
  assert.equal(calls.create[0].body.priceCOP, 0);
  assert.equal(calls.create[0].body.durationMinutes, 45);
});

test("buscar_cliente devuelve clientes con la query y el tenant de la ruta", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("buscar_cliente", { query: "camila" }, CONTEXT, deps);

  assert.equal(result.ok, true);
  assert.equal(calls.searchCustomers[0].tenantId, "tenant-1");
  assert.equal(calls.searchCustomers[0].query, "camila");
  assert.equal(result.data.count, 2);
  assert.deepEqual(result.data.customers[0], { id: "cus_1", name: "Camila Rojas", phone: "3001234567" });
});

test("buscar_cliente exige query y limita a 40 caracteres", async () => {
  const { deps } = fakeDeps();
  for (const args of [{}, { query: "" }, { query: "x".repeat(41) }]) {
    const result = await executeTool("buscar_cliente", args, CONTEXT, deps);
    assert.equal(result.ok, false, JSON.stringify(args));
    assert.equal(result.error.code, "invalid_arguments");
  }
});

test("crear_cita con teléfono nuevo crea el cliente y vincula la cita", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("crear_cita", {
    customerName: "Ana Pérez",
    customerPhone: "300 999 8888",
    serviceName: "Corte",
    startsAt: "2030-03-20T10:00",
  }, CONTEXT, deps);

  assert.equal(result.ok, true);
  assert.equal(calls.findCustomerByPhone[0].phone, "3009998888");
  assert.equal(calls.createCustomer.length, 1);
  assert.deepEqual(calls.createCustomer[0].body, { name: "Ana Pérez", phone: "3009998888" });
  assert.equal(calls.create[0].body.customerId, "cus_nuevo");
  assert.equal(calls.create[0].body.customerName, "Ana Pérez");
  assert.equal(calls.create[0].body.customerPhone, "3009998888");
});

test("crear_cita con teléfono existente reutiliza el cliente sin crear otro", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("crear_cita", {
    customerName: "Nombre que no debe usarse",
    customerPhone: "3001234567",
    serviceName: "Corte",
    startsAt: "2030-03-20T10:00",
  }, CONTEXT, deps);

  assert.equal(result.ok, true);
  assert.equal(calls.createCustomer.length, 0);
  assert.equal(calls.create[0].body.customerId, "cus_1");
  assert.equal(calls.create[0].body.customerName, "Camila Rojas");
  assert.equal(calls.create[0].body.customerPhone, "3001234567");
});

test("crear_cita con teléfono y sin nombre usa 'Cliente'", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("crear_cita", {
    customerPhone: "300 777 6666",
    serviceName: "Corte",
    startsAt: "2030-03-20T10:00",
  }, CONTEXT, deps);

  assert.equal(result.ok, true);
  assert.equal(calls.createCustomer[0].body.name, "Cliente");
  assert.equal(calls.create[0].body.customerId, "cus_nuevo");
});

test("crear_cita con teléfono inválido no crea nada", async () => {
  const { deps, calls } = fakeDeps();
  const result = await executeTool("crear_cita", {
    customerName: "Ana",
    customerPhone: "123",
    serviceName: "Corte",
    startsAt: "2030-03-20T10:00",
  }, CONTEXT, deps);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_customer_phone");
  assert.equal(calls.findCustomerByPhone.length, 0);
  assert.equal(calls.createCustomer.length, 0);
  assert.equal(calls.create.length, 0);
});

test("crear_cita propaga el error si el cliente no se puede crear", async () => {
  const { deps } = fakeDeps({
    createCustomer: async () => ({
      ok: false,
      status: 409,
      code: "customer_phone_taken",
      message: "Ya existe un cliente con ese teléfono en el negocio.",
    }),
  });
  const result = await executeTool("crear_cita", {
    customerPhone: "300 555 4444",
    serviceName: "Corte",
    startsAt: "2030-03-20T10:00",
  }, CONTEXT, deps);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "customer_phone_taken");
});

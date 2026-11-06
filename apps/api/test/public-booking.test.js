import test from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_AVAILABILITY_DAYS,
  isValidPublicSlug,
  resolvePublicAvailabilityDate,
  resolvePublicDuration,
  sanitizePublicProfessional,
  sanitizePublicService,
  sanitizePublicTenant,
  validatePublicBookingInput,
  validatePublicStart,
} from "../src/public-booking.js";
import { DEFAULT_OPENING_HOURS } from "../src/availability.js";

const BOGOTA = "America/Bogota";
const NOW = new Date("2026-11-06T15:00:00.000Z"); // viernes 6 de noviembre, 10:00 en Bogotá

test("valida el slug público", () => {
  assert.equal(isValidPublicSlug("barberia-araan"), true);
  assert.equal(isValidPublicSlug("negocio123"), true);
  for (const slug of ["", "Barberia", "barberia_araan", "barberia araan", "-barberia", "barberia-", "x".repeat(51), null, 42]) {
    assert.equal(isValidPublicSlug(slug), false, String(slug));
  }
});

test("fecha obligatoria y dentro de los próximos 60 días", () => {
  const within = resolvePublicAvailabilityDate({ date: "2026-11-06", now: NOW, timeZone: BOGOTA });
  assert.equal(within.ok, true);
  assert.equal(within.value.date, "2026-11-06");

  const last = resolvePublicAvailabilityDate({ date: "2027-01-05", now: NOW, timeZone: BOGOTA });
  assert.equal(last.ok, true); // 60 días exactos
  assert.equal(PUBLIC_AVAILABILITY_DAYS, 60);

  for (const date of [undefined, "", "2026-11-05", "2027-01-06", "06/11/2026", "2026-02-30"]) {
    const result = resolvePublicAvailabilityDate({ date, now: NOW, timeZone: BOGOTA });
    assert.equal(result.ok, false, String(date));
    assert.equal(result.status, 400);
    assert.equal(result.code, "invalid_date");
  }
});

test("la duración sale del servicio o 30 min por defecto", () => {
  assert.equal(resolvePublicDuration({ durationMinutes: 60 }), 60);
  assert.equal(resolvePublicDuration({ durationMinutes: 15 }), 15);
  assert.equal(resolvePublicDuration({}), 30);
  assert.equal(resolvePublicDuration({ durationMinutes: 0 }), 30);
  assert.equal(resolvePublicDuration(null), 30);
});

test("valida la reserva pública", () => {
  const valid = validatePublicBookingInput({
    customerName: "  Camila Rojas ",
    customerPhone: "300 123 4567",
    serviceId: "svc_1",
    professionalId: "pro_1",
    startsAt: "2026-11-20T10:00",
    clientRequestId: " req-1 ",
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value, {
    customerName: "Camila Rojas",
    customerPhone: "3001234567",
    serviceId: "svc_1",
    professionalId: "pro_1",
    startsAtLocal: "2026-11-20T10:00",
    clientRequestId: "req-1",
  });

  const noProfessional = validatePublicBookingInput({
    customerName: "Camila", customerPhone: "3001234567", serviceId: "svc_1", startsAt: "2026-11-20T10:00",
  });
  assert.equal(noProfessional.value.professionalId, null);
  assert.equal(noProfessional.value.clientRequestId, null);

  const cases = [
    ["invalid_name", { customerName: "A", customerPhone: "3001234567", serviceId: "s", startsAt: "2026-11-20T10:00" }],
    ["invalid_customer_phone", { customerName: "Camila", customerPhone: "12345", serviceId: "s", startsAt: "2026-11-20T10:00" }],
    ["invalid_customer_phone", { customerName: "Camila", customerPhone: "1234567890123456", serviceId: "s", startsAt: "2026-11-20T10:00" }],
    ["invalid_customer_phone", { customerName: "Camila", serviceId: "s", startsAt: "2026-11-20T10:00" }],
    ["invalid_start", { customerName: "Camila", customerPhone: "3001234567", serviceId: "s", startsAt: "2026-11-20" }],
    ["invalid_start", { customerName: "Camila", customerPhone: "3001234567", serviceId: "s" }],
  ];
  for (const [code, body] of cases) {
    const result = validatePublicBookingInput(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, code, JSON.stringify(body));
  }

  const noService = validatePublicBookingInput({ customerName: "Camila", customerPhone: "3001234567", startsAt: "2026-11-20T10:00" });
  assert.equal(noService.ok, false);
  assert.equal(noService.status, 404);
  assert.equal(noService.code, "service_not_found");
});

test("la cita pública debe ser futura y caber en el horario", () => {
  const inside = validatePublicStart({
    startsAtLocal: "2026-11-20T10:00",
    durationMinutes: 60,
    openingHours: DEFAULT_OPENING_HOURS,
    timeZone: BOGOTA,
    now: NOW,
  });
  assert.equal(inside.ok, true);
  assert.equal(inside.value.startsAtLocal, "2026-11-20T10:00");
  assert.equal(inside.value.startsAtUtc.toISOString(), "2026-11-20T15:00:00.000Z");

  const cases = [
    { startsAtLocal: "2026-11-20T17:30", durationMinutes: 60 }, // termina después del cierre
    { startsAtLocal: "2026-11-20T08:30", durationMinutes: 30 }, // antes de abrir
    { startsAtLocal: "2026-11-22T10:00", durationMinutes: 30 }, // domingo cerrado... 22/11/2026 es domingo
    { startsAtLocal: "2026-11-06T09:00", durationMinutes: 30 }, // ya pasó (10:00 en Bogotá)
    { startsAtLocal: "2026-01-01T10:00", durationMinutes: 30 },
  ];
  for (const body of cases) {
    const result = validatePublicStart({ ...body, openingHours: DEFAULT_OPENING_HOURS, timeZone: BOGOTA, now: NOW });
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, "outside_business_hours");
  }
});

test("el saneado público nunca incluye datos privados", () => {
  const tenant = sanitizePublicTenant({
    name: "Barbería Araan",
    slug: "barberia-araan",
    sector: "barberia",
    description: "Con estilo",
    address: "Calle 1",
    phone: "6012345678",
    socialLinks: { instagram: "https://instagram.com/x", facebook: "", tiktok: "", whatsapp: "3001234567", website: "" },
    timeZone: "America/Bogota",
    ownerEmail: "duena@example.com",
    createdBy: "uid-owner",
    status: "active",
    commission: { type: "percentage", percent: 50 },
    notes: "privadas",
  });
  assert.deepEqual(Object.keys(tenant).sort(), [
    "address", "description", "name", "phone", "sector", "slug", "socialLinks", "timeZone",
  ]);
  assert.equal(JSON.stringify(tenant).includes("duena@example.com"), false);

  const service = sanitizePublicService({
    serviceId: "svc_1",
    name: "Corte",
    description: "Clásico",
    category: "Cortes",
    durationMinutes: 45,
    priceCOP: 50000,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.deepEqual(Object.keys(service).sort(), [
    "category", "description", "durationMinutes", "name", "priceCOP", "serviceId",
  ]);

  const professional = sanitizePublicProfessional({
    professionalId: "pro_1",
    name: "Andrés",
    phone: "3001234567",
    email: "andres@example.com",
    commission: { type: "percentage", percent: 50 },
    notes: "privado",
  });
  assert.deepEqual(professional, { professionalId: "pro_1", name: "Andrés" });
  assert.equal(JSON.stringify(professional).includes("3001234567"), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INVITATION_DAYS,
  buildInvitationLink,
  buildPublicInvitation,
  computeInvitationStatus,
  generateInvitationToken,
  hashInvitationToken,
  resolveInvitationDays,
  serializeInvitation,
  validateInvitationInput,
} from "../src/invitation-catalog.js";

const ENV = { PUBLIC_APP_URL: "https://app.alaia.test/", INVITATION_DAYS: "7" };

test("token aleatorio de 32 bytes en base64url y hash sha256", () => {
  const first = generateInvitationToken();
  const second = generateInvitationToken();
  assert.equal(first.length, 43);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second);

  const hash = hashInvitationToken(first);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashInvitationToken(first), hash);
  assert.notEqual(hashInvitationToken(second), hash);
});

test("días de vigencia desde INVITATION_DAYS", () => {
  assert.equal(resolveInvitationDays({}), DEFAULT_INVITATION_DAYS);
  assert.equal(resolveInvitationDays({ INVITATION_DAYS: "3" }), 3);
  for (const value of ["0", "-1", "abc", "999"]) {
    assert.equal(resolveInvitationDays({ INVITATION_DAYS: value }), DEFAULT_INVITATION_DAYS, value);
  }
});

test("link con PUBLIC_APP_URL y fallback", () => {
  assert.equal(buildInvitationLink("TOKEN", ENV), "https://app.alaia.test/invite/TOKEN");
  assert.equal(buildInvitationLink("TOKEN", {}), "http://localhost:5173/invite/TOKEN");
  assert.equal(buildInvitationLink("TOKEN", { PUBLIC_APP_URL: "  " }), "http://localhost:5173/invite/TOKEN");
});

test("valida el invitado: correo o teléfono obligatorios", () => {
  const byEmail = validateInvitationInput({ professionalId: "pro_1", email: "andres@example.com" });
  assert.equal(byEmail.ok, true);
  assert.deepEqual(byEmail.value, { professionalId: "pro_1", email: "andres@example.com", phone: "" });

  const byPhone = validateInvitationInput({ professionalId: "pro_1", phone: "+57 300 123 4567" });
  assert.equal(byPhone.ok, true);
  assert.equal(byPhone.value.phone, "573001234567");

  const cases = [
    { email: "andres@example.com" },
    { professionalId: "pro_1" },
    { professionalId: "pro_1", email: "malo" },
    { professionalId: "pro_1", email: 42 },
    { professionalId: "pro_1", phone: "123" },
    { professionalId: "pro_1", phone: "1234567890123456" },
    { professionalId: "pro_1", phone: 3001234567 },
    { professionalId: "pro_1", email: "" },
  ];
  for (const body of cases) {
    const result = validateInvitationInput(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, "invalid_invitee");
  }
});

test("estado calculado de la invitación", () => {
  const now = new Date("2026-11-06T15:00:00.000Z");
  assert.equal(computeInvitationStatus({ status: "pending", expiresAt: new Date("2026-11-13T15:00:00.000Z") }, now), "pending");
  assert.equal(computeInvitationStatus({ status: "pending", expiresAt: new Date("2026-11-01T15:00:00.000Z") }, now), "expired");
  assert.equal(computeInvitationStatus({ status: "accepted", expiresAt: new Date("2026-11-13T15:00:00.000Z") }, now), "accepted");
  assert.equal(computeInvitationStatus({ status: "cancelled" }, now), "cancelled");
  assert.equal(computeInvitationStatus({ status: "expired" }, now), "expired");
  assert.equal(computeInvitationStatus({ status: "pending" }, now), "pending");
});

test("serialización de administración sin token ni hash", () => {
  const serialized = serializeInvitation("inv_1", {
    professionalId: "pro_1",
    professionalName: "Andrés",
    email: "andres@example.com",
    phone: "3001234567",
    tokenHash: "hash-secreto",
    status: "pending",
    expiresAt: new Date("2026-11-13T15:00:00.000Z"),
    createdAt: new Date("2026-11-06T15:00:00.000Z"),
    acceptedBy: null,
    acceptedAt: null,
  });
  assert.equal(JSON.stringify(serialized).includes("hash-secreto"), false);
  assert.equal(Object.hasOwn(serialized, "tokenHash"), false);
  assert.equal(serialized.professionalName, "Andrés");
  assert.equal(serialized.status, "pending");
  assert.equal(serialized.expiresAt, "2026-11-13T15:00:00.000Z");
});

test("vista pública de la invitación", () => {
  const pending = buildPublicInvitation({
    tenant: { name: "Barbería Araan", slug: "barberia-araan" },
    professionalName: "Andrés",
    invitation: { email: "andres@example.com", status: "pending", expiresAt: new Date("2026-11-13T15:00:00.000Z") },
  });
  assert.deepEqual(pending.tenant, { name: "Barbería Araan", slug: "barberia-araan" });
  assert.deepEqual(pending.professional, { name: "Andrés" });
  assert.equal(pending.valid, true);
  assert.equal(pending.email, "andres@example.com");

  const expired = buildPublicInvitation({
    tenant: { name: "Barbería", slug: "barberia" },
    professionalName: "Andrés",
    invitation: { status: "pending", expiresAt: new Date("2026-01-01T00:00:00.000Z") },
    now: new Date("2026-11-06T15:00:00.000Z"),
  });
  assert.equal(expired.valid, false);
  assert.equal(expired.status, "expired");
});

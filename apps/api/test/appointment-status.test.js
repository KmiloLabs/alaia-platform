import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  UPDATABLE_APPOINTMENT_STATUSES,
  canUpdateAppointmentStatus,
  isActiveAppointmentStatus,
  validateAppointmentStatusUpdate,
} from "../src/appointment-status.js";

test("estados válidos y transiciones permitidas por la ruta de asistencia", () => {
  assert.deepEqual([...UPDATABLE_APPOINTMENT_STATUSES], ["scheduled", "completed", "no_show"]);
  for (const status of ["scheduled", "completed", "no_show"]) {
    const result = validateAppointmentStatusUpdate({ status });
    assert.equal(result.ok, true, status);
    assert.deepEqual(result.value, { status });
  }
  for (const body of [{ status: "cancelled" }, { status: "inventado" }, {}, null]) {
    const result = validateAppointmentStatusUpdate(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, "invalid_status");
  }
});

test("scheduled y completed cuentan; cancelled y no_show no", () => {
  assert.deepEqual([...ACTIVE_APPOINTMENT_STATUSES], ["scheduled", "completed"]);
  assert.equal(isActiveAppointmentStatus("scheduled"), true);
  assert.equal(isActiveAppointmentStatus("completed"), true);
  assert.equal(isActiveAppointmentStatus("cancelled"), false);
  assert.equal(isActiveAppointmentStatus("no_show"), false);
  assert.equal(isActiveAppointmentStatus(undefined), false);
});

test("permisos para marcar asistencia", () => {
  const base = { appointmentProfessionalId: "pro_1" };
  assert.equal(canUpdateAppointmentStatus({ ...base, role: "owner" }), true);
  assert.equal(canUpdateAppointmentStatus({ ...base, role: "admin" }), true);
  assert.equal(canUpdateAppointmentStatus({ ...base, role: "professional", professionalId: "pro_1" }), true);
  assert.equal(canUpdateAppointmentStatus({ ...base, role: "professional", professionalId: "pro_2" }), false);
  assert.equal(canUpdateAppointmentStatus({ ...base, role: "professional", professionalId: null }), false);
  assert.equal(canUpdateAppointmentStatus({ ...base, role: "client", professionalId: "pro_1" }), false);
  assert.equal(canUpdateAppointmentStatus({ ...base, role: null }), false);
  assert.equal(
    canUpdateAppointmentStatus({ role: "professional", professionalId: "pro_1", appointmentProfessionalId: null }),
    false,
  );
});

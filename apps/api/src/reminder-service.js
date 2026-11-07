// Programación y ejecución de recordatorios. La creación/cancelación/
// reprogramación de citas llama a estos helpers; el cron ejecuta processDue.

import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { resolveWhatsappMode, sendWhatsappGraphMessage } from "./whatsapp.js";
import { whatsappNumberRepository, whatsappOutboxRepository } from "./whatsapp-repository.js";
import {
  computeReminderSchedule,
  renderReminderMessage,
  resolveReminders,
  reminderMessageVariables,
} from "./reminder-config.js";
import { reminderRepository } from "./reminder-repository.js";

const MAX_ATTEMPTS = 3;
const SUMMARY_WINDOW_DAYS = 7;

// Crea los recordatorios pending de una cita recién creada. Idempotente por
// appointmentId+kind; no programa avisos cuyo sendAt ya pasó.
export async function scheduleRemindersForAppointment({ tenant, appointment, now = new Date() }) {
  if (!tenant || !appointment) return 0;
  const config = resolveReminders(tenant);
  const schedule = computeReminderSchedule({
    reminders: config,
    startsAt: appointment.startsAt ?? appointment.startsAtUtc,
    now,
  });
  if (schedule.length === 0) return 0;

  for (const item of schedule) {
    await reminderRepository.schedule({
      tenantId: tenant.id,
      appointmentId: appointment.appointmentId,
      kind: item.kind,
      sendAt: item.sendAt,
      data: {
        tenantId: tenant.id,
        customerName: appointment.customerName ?? null,
        customerPhone: appointment.customerPhone ?? null,
        startsAtLocal: appointment.startsAtLocal ?? null,
        serviceName: appointment.serviceName ?? null,
      },
    });
  }
  return schedule.length;
}

export async function skipPendingReminders({ tenantId, appointmentId, note = null }) {
  if (!tenantId || !appointmentId) return 0;
  return reminderRepository.markPendingSkipped({ tenantId, appointmentId, note });
}

// Reprogramar: se saltan los pendientes y se vuelven a calcular con el nuevo inicio.
export async function rescheduleRemindersForAppointment({ tenant, appointment, now = new Date() }) {
  if (!tenant || !appointment) return 0;
  await skipPendingReminders({ tenantId: tenant.id, appointmentId: appointment.appointmentId, note: "reprogramada" });
  return scheduleRemindersForAppointment({ tenant, appointment, now });
}

// Ejecuta hasta 50 recordatorios pendientes con sendAt <= now.
export async function processDueReminders({ now = new Date(), env = process.env, fetchImpl = fetch, limit = 50 } = {}) {
  const due = await reminderRepository.findDue(now, limit);
  const counters = { processed: due.length, sent: 0, skipped: 0, failed: 0 };
  const mode = resolveWhatsappMode(env);

  for (const item of due) {
    const { tenantId, reminderId, data } = item;
    const appointmentsRef = db.collection("tenants").doc(tenantId).collection("appointments");
    try {
      const tenantSnapshot = await db.collection("tenants").doc(tenantId).get();
      if (!tenantSnapshot.exists) {
        await reminderRepository.update({ tenantId, reminderId, data: { status: "failed", error: "tenant_not_found" } });
        counters.failed += 1;
        continue;
      }
      const tenant = { id: tenantId, ...tenantSnapshot.data() };
      const config = resolveReminders(tenant);

      if (!config.enabled) {
        await reminderRepository.update({ tenantId, reminderId, data: { status: "skipped", error: "reminders_disabled" } });
        counters.skipped += 1;
        continue;
      }

      const appointmentSnapshot = data.appointmentId ? await appointmentsRef.doc(data.appointmentId).get() : null;
      if (!appointmentSnapshot || !appointmentSnapshot.exists) {
        await reminderRepository.update({ tenantId, reminderId, data: { status: "skipped", error: "appointment_not_found" } });
        counters.skipped += 1;
        continue;
      }
      const appointment = appointmentSnapshot.data();
      if (appointment.status === "cancelled") {
        await reminderRepository.update({ tenantId, reminderId, data: { status: "skipped", error: "appointment_cancelled" } });
        counters.skipped += 1;
        continue;
      }

      const phone = normalizePhone(data.customerPhone ?? appointment.customerPhone);
      if (phone === null) {
        await reminderRepository.update({ tenantId, reminderId, data: { status: "skipped", error: "missing_phone" } });
        counters.skipped += 1;
        continue;
      }

      if (mode === "off") {
        await reminderRepository.update({ tenantId, reminderId, data: { status: "skipped", error: "whatsapp_disabled" } });
        counters.skipped += 1;
        continue;
      }

      const text = renderReminderMessage(config.message, reminderMessageVariables({
        tenantName: tenant.name,
        appointment: {
          customerName: data.customerName ?? appointment.customerName,
          startsAtLocal: data.startsAtLocal ?? appointment.startsAtLocal,
          serviceName: data.serviceName ?? appointment.serviceName,
        },
      }));
      const attempts = Number.isInteger(data.attempts) ? data.attempts : 0;
      const nextAttempts = attempts + 1;

      if (mode === "sandbox") {
        await whatsappOutboxRepository.record(tenantId, {
          tenantId,
          source: "reminder",
          reminderId,
          appointmentId: data.appointmentId,
          kind: data.kind,
          phoneNumberId: null,
          to: phone,
          text,
          mode: "sandbox",
          status: "recorded",
        });
        await reminderRepository.update({
          tenantId,
          reminderId,
          data: { status: "sent", sentAt: FieldValue.serverTimestamp(), attempts: nextAttempts, error: null },
        });
        counters.sent += 1;
        continue;
      }

      // live: requiere un número activo conectado al negocio.
      const number = await whatsappNumberRepository.findActiveByTenant(tenantId);
      if (!number) {
        await reminderRepository.update({
          tenantId,
          reminderId,
          data: { status: "failed", attempts: nextAttempts, error: "whatsapp_not_connected" },
        });
        counters.failed += 1;
        continue;
      }

      const delivery = await sendWhatsappGraphMessage({
        phoneNumberId: number.phoneNumberId,
        to: phone,
        text,
        env,
        fetchImpl,
      });
      if (delivery.ok) {
        await whatsappOutboxRepository.record(tenantId, {
          tenantId,
          source: "reminder",
          reminderId,
          appointmentId: data.appointmentId,
          kind: data.kind,
          phoneNumberId: number.phoneNumberId,
          to: phone,
          text,
          mode: "live",
          status: "sent",
        });
        await reminderRepository.update({
          tenantId,
          reminderId,
          data: { status: "sent", sentAt: FieldValue.serverTimestamp(), attempts: nextAttempts, error: null },
        });
        counters.sent += 1;
        continue;
      }

      if (nextAttempts >= MAX_ATTEMPTS) {
        await reminderRepository.update({
          tenantId,
          reminderId,
          data: { status: "failed", attempts: nextAttempts, error: String(delivery.error ?? "send_failed").slice(0, 300) },
        });
        counters.failed += 1;
      } else {
        // Se reintenta en la siguiente pasada del cron.
        await reminderRepository.update({
          tenantId,
          reminderId,
          data: { attempts: nextAttempts, error: String(delivery.error ?? "send_failed").slice(0, 300) },
        });
      }
    } catch (error) {
      counters.failed += 1;
      try {
        await reminderRepository.update({
          tenantId,
          reminderId,
          data: { status: "failed", error: String(error?.message ?? error).slice(0, 300) },
        });
      } catch {
        // Si ni siquiera se puede marcar, el contador ya refleja el fallo.
      }
    }
  }

  return counters;
}

export async function getReminderSummary({ tenantId, now = new Date() }) {
  const reminders = await reminderRepository.listByTenant(tenantId);
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const endMs = nowMs + SUMMARY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const summary = { pending: 0, sent: 0, skipped: 0, failed: 0 };
  for (const item of reminders) {
    const sendAtMs = toMillis(item.data.sendAt);
    if (sendAtMs === null || sendAtMs < nowMs || sendAtMs > endMs) continue;
    const status = item.data.status;
    if (Object.hasOwn(summary, status)) summary[status] += 1;
  }
  return {
    windowDays: SUMMARY_WINDOW_DAYS,
    from: new Date(nowMs).toISOString(),
    to: new Date(endMs).toISOString(),
    ...summary,
    total: summary.pending + summary.sent + summary.skipped + summary.failed,
  };
}

export async function markReminderSkipped({ tenantId, reminderId, error = null }) {
  await reminderRepository.update({ tenantId, reminderId, data: { status: "skipped", error } });
}

function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

// Persistencia de recordatorios programados y consultas para el cron.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase.js";

function remindersRef(tenantId) {
  return db.collection("tenants").doc(tenantId).collection("reminders");
}

function reminderDocId(appointmentId, kind) {
  return `${appointmentId}_${kind}`;
}

export const reminderRepository = {
  // Un recordatorio por appointmentId+kind: el id determinista evita duplicados
  // y, al reprogramar, actualiza el mismo documento con el nuevo sendAt.
  async schedule({ tenantId, appointmentId, kind, sendAt, data }) {
    const ref = remindersRef(tenantId).doc(reminderDocId(appointmentId, kind));
    await ref.set({
      ...data,
      appointmentId,
      kind,
      sendAt: Timestamp.fromDate(sendAt),
      status: "pending",
      attempts: 0,
      sentAt: null,
      error: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return ref.id;
  },

  async markPendingSkipped({ tenantId, appointmentId, note = null }) {
    const snapshot = await remindersRef(tenantId).where("appointmentId", "==", appointmentId).get();
    const pending = snapshot.docs.filter((doc) => doc.data().status === "pending");
    if (pending.length === 0) return 0;
    const batch = db.batch();
    for (const doc of pending) {
      batch.set(doc.ref, {
        status: "skipped",
        error: note,
        skippedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
    return pending.length;
  },

  // Pendientes con sendAt <= now, en orden ascendente, hasta `limit`.
  async findDue(now, limit = 50) {
    const snapshot = await db.collectionGroup("reminders")
      .where("status", "==", "pending")
      .limit(500)
      .get();
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
    return snapshot.docs
      .map((doc) => {
        const tenantRef = doc.ref.parent.parent;
        return {
          tenantId: tenantRef?.id ?? null,
          reminderId: doc.id,
          ref: doc.ref,
          data: doc.data(),
        };
      })
      .filter((item) => item.tenantId !== null)
      .filter((item) => {
        const sendAtMs = toMillis(item.data.sendAt);
        return sendAtMs !== null && sendAtMs <= nowMs;
      })
      .sort((a, b) => toMillis(a.data.sendAt) - toMillis(b.data.sendAt))
      .slice(0, limit);
  },

  async listByTenant(tenantId) {
    const snapshot = await remindersRef(tenantId).get();
    return snapshot.docs.map((doc) => ({ reminderId: doc.id, data: doc.data() }));
  },

  async update({ tenantId, reminderId, data }) {
    await remindersRef(tenantId).doc(reminderId).set({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  },
};

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

// Persistencia del canal de WhatsApp: mapeo número -> negocio, dedupe de mensajes
// entrantes y bandeja de salida del modo de prueba.

import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";

export const whatsappNumberRepository = {
  async get(phoneNumberId) {
    const snapshot = await db.collection("whatsappNumbers").doc(phoneNumberId).get();
    return snapshot.exists ? { phoneNumberId: snapshot.id, ...snapshot.data() } : null;
  },

  async set(phoneNumberId, data) {
    await db.collection("whatsappNumbers").doc(phoneNumberId).set({ ...data }, { merge: true });
    return this.get(phoneNumberId);
  },

  async delete(phoneNumberId) {
    await db.collection("whatsappNumbers").doc(phoneNumberId).delete();
  },

  async listByTenant(tenantId) {
    const snapshot = await db.collection("whatsappNumbers").where("tenantId", "==", tenantId).get();
    return snapshot.docs.map((doc) => ({ phoneNumberId: doc.id, ...doc.data() }));
  },

  // Si hay más de un número activo, gana el conectado más recientemente.
  async findActiveByTenant(tenantId) {
    const numbers = await this.listByTenant(tenantId);
    return numbers
      .filter((number) => number.status === "active")
      .sort((a, b) => toMillis(b.connectedAt) - toMillis(a.connectedAt))[0] ?? null;
  },
};

export const whatsappMessageRepository = {
  // Reclama el message.id en transacción: false si ya fue procesado/registrado.
  async claim(messageId, data) {
    const ref = db.collection("whatsappMessages").doc(messageId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) return false;
      transaction.set(ref, {
        ...data,
        status: "processing",
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
  },

  async update(messageId, data) {
    await db.collection("whatsappMessages").doc(messageId).set({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  },
};

export const whatsappOutboxRepository = {
  async record(tenantId, data) {
    const ref = db.collection("tenants").doc(tenantId).collection("whatsappOutbox").doc();
    await ref.set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  },
};

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  return 0;
}

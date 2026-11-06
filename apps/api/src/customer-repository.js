// Persistencia de clientes. Todo el acceso a Firestore del catálogo de clientes
// vive aquí; customer-catalog.js es lógica pura y recibe este repositorio.

import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";

function customersCollection(tenantId) {
  return db.collection("tenants").doc(tenantId).collection("customers");
}

export const customerRepository = {
  async list(tenantId) {
    const snapshot = await customersCollection(tenantId).get();
    return snapshot.docs.map((doc) => ({ customerId: doc.id, data: doc.data() }));
  },

  async get(tenantId, customerId) {
    const snapshot = await customersCollection(tenantId).doc(customerId).get();
    return snapshot.exists ? { customerId: snapshot.id, data: snapshot.data() } : null;
  },

  // Único por tenant: el teléfono se guarda normalizado (solo dígitos).
  async findByPhone(tenantId, phone) {
    const snapshot = await customersCollection(tenantId)
      .where("phone", "==", phone)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { customerId: doc.id, data: doc.data() };
  },

  async create(tenantId, data) {
    const ref = customersCollection(tenantId).doc();
    await ref.set({
      ...data,
      id: ref.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const snapshot = await ref.get();
    return { customerId: ref.id, data: snapshot.data() };
  },

  async update(tenantId, customerId, data) {
    const ref = customersCollection(tenantId).doc(customerId);
    await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const snapshot = await ref.get();
    return { customerId, data: snapshot.data() };
  },
};

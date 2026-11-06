// Persistencia del catálogo de servicios. Todo el acceso a Firestore del
// catálogo vive aquí; service-catalog.js es lógica pura y recibe este repositorio
// (así las pruebas unitarias pueden usar un doble en memoria).

import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";

function servicesCollection(tenantId) {
  return db.collection("tenants").doc(tenantId).collection("services");
}

export const serviceRepository = {
  async list(tenantId) {
    const snapshot = await servicesCollection(tenantId).get();
    return snapshot.docs.map((doc) => ({ serviceId: doc.id, data: doc.data() }));
  },

  async get(tenantId, serviceId) {
    const snapshot = await servicesCollection(tenantId).doc(serviceId).get();
    return snapshot.exists ? { serviceId: snapshot.id, data: snapshot.data() } : null;
  },

  async create(tenantId, data) {
    const ref = servicesCollection(tenantId).doc();
    await ref.set({
      ...data,
      id: ref.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const snapshot = await ref.get();
    return { serviceId: ref.id, data: snapshot.data() };
  },

  async delete(tenantId, serviceId) {
    await db.collection("tenants").doc(tenantId).collection("services").doc(serviceId).delete();
  },

  async update(tenantId, serviceId, data) {
    const ref = servicesCollection(tenantId).doc(serviceId);
    await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const snapshot = await ref.get();
    return { serviceId, data: snapshot.data() };
  },
};

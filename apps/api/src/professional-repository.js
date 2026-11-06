// Persistencia de profesionales. Todo el acceso a Firestore del equipo vive
// aquí; professional-catalog.js es lógica pura y recibe este repositorio.

import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";

function professionalsCollection(tenantId) {
  return db.collection("tenants").doc(tenantId).collection("professionals");
}

export const professionalRepository = {
  async list(tenantId) {
    const snapshot = await professionalsCollection(tenantId).get();
    return snapshot.docs.map((doc) => ({ professionalId: doc.id, data: doc.data() }));
  },

  async get(tenantId, professionalId) {
    const snapshot = await professionalsCollection(tenantId).doc(professionalId).get();
    return snapshot.exists ? { professionalId: snapshot.id, data: snapshot.data() } : null;
  },

  async create(tenantId, data) {
    const ref = professionalsCollection(tenantId).doc();
    await ref.set({
      ...data,
      id: ref.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const snapshot = await ref.get();
    return { professionalId: ref.id, data: snapshot.data() };
  },

  async update(tenantId, professionalId, data) {
    const ref = professionalsCollection(tenantId).doc(professionalId);
    await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const snapshot = await ref.get();
    return { professionalId, data: snapshot.data() };
  },
};

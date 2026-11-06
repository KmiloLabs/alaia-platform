// Persistencia de invitaciones. El token completo nunca se guarda: solo su hash.

import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";

function invitationsCollection(tenantId) {
  return db.collection("tenants").doc(tenantId).collection("invitations");
}

export const invitationRepository = {
  async list(tenantId) {
    const snapshot = await invitationsCollection(tenantId).get();
    return snapshot.docs.map((doc) => ({ invitationId: doc.id, data: doc.data() }));
  },

  async get(tenantId, invitationId) {
    const snapshot = await invitationsCollection(tenantId).doc(invitationId).get();
    return snapshot.exists ? { invitationId: snapshot.id, data: snapshot.data() } : null;
  },

  // Búsqueda pública por token: no conocemos el tenant, así que es collection group.
  async findByTokenHash(tokenHash) {
    const snapshot = await db.collectionGroup("invitations")
      .where("tokenHash", "==", tokenHash)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const tenantRef = doc.ref.parent.parent;
    if (!tenantRef) return null;
    return { tenantId: tenantRef.id, tenantRef, invitationId: doc.id, ref: doc.ref, data: doc.data() };
  },

  async create(tenantId, data) {
    const ref = invitationsCollection(tenantId).doc();
    await ref.set({
      ...data,
      id: ref.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    const snapshot = await ref.get();
    return { invitationId: ref.id, data: snapshot.data() };
  },

  async update(tenantId, invitationId, data) {
    const ref = invitationsCollection(tenantId).doc(invitationId);
    await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const snapshot = await ref.get();
    return { invitationId, data: snapshot.data() };
  },
};

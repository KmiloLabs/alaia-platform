// Rellena users/{uid}.tenantIds a partir de las membresías existentes.
// Uso: node --env-file=.env.real scripts/backfill-user-tenants.mjs
// Idempotente: usa arrayUnion.

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || "alaia-3f637";
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const tenants = await db.collection("tenants").get();
let updated = 0;

for (const tenantDoc of tenants.docs) {
  const memberships = await tenantDoc.ref.collection("memberships").get();
  for (const membership of memberships.docs) {
    const data = membership.data();
    if (data.status !== "active") continue;
    const uid = data.userId ?? membership.id;
    await db.collection("users").doc(uid).set(
      { tenantIds: FieldValue.arrayUnion(tenantDoc.id), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    updated += 1;
  }
}

console.log(`Membresías indexadas: ${updated} en ${tenants.size} negocio(s).`);

// Borra los negocios de prueba creados durante la verificación.
// Criterio: el negocio es de prueba si TODOS sus miembros tienen correo @alaia.test.
// Uso: node scripts/cleanup-test-tenants.mjs [--apply]

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "demo-alaia";
if (projectId === "demo-alaia") {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8081";
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();

const tenants = await db.collection("tenants").get();
const targets = [];
const kept = [];

for (const tenantDoc of tenants.docs) {
  const members = await tenantDoc.ref.collection("memberships").get();
  const emails = [];
  for (const member of members.docs) {
    const uid = member.id;
    const user = await auth.getUser(uid).catch(() => null);
    if (user?.email) emails.push(user.email);
  }
  const isTest = emails.length > 0 && emails.every((email) => /@(alaia\.test|example\.com)$/i.test(email));
  const entry = { tenantId: tenantDoc.id, name: tenantDoc.data().name ?? "", slug: tenantDoc.data().slug, emails };
  if (isTest) targets.push(entry);
  else kept.push(entry);
}

console.log(`Negocios totales: ${tenants.size}`);
console.log(`De prueba: ${targets.length}`);
console.log(`Reales (se conservan): ${kept.length}`);
for (const entry of kept.slice(0, 10)) {
  console.log(`  conservado: "${entry.name}" (${entry.emails.join(", ") || "sin miembros"})`);
}

if (!apply) {
  console.log("\nSimulación. Ejecuta de nuevo con --apply para borrar los de prueba.");
  process.exit(0);
}

let deleted = 0;
for (const entry of targets) {
  if (entry.slug) {
    await db.collection("tenantSlugs").doc(entry.slug).delete();
  }
  await db.recursiveDelete(db.collection("tenants").doc(entry.tenantId));
  deleted += 1;
}
console.log(`\nBorrados ${deleted} negocios de prueba con sus datos.`);

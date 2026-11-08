// Paso 1: exporta del emulador la cuenta y sus negocios a un JSON.
// Uso: node --env-file=.env.emulator-backup scripts/export-emulator-tenant.mjs <email> <archivo-salida>
// IMPORTANTE: ejecutar solo con variables del emulador (sin credenciales reales).

import { writeFileSync } from "node:fs";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
const outputPath = process.argv[3];
if (!email || !outputPath) {
  console.error("Uso: node scripts/export-emulator-tenant.mjs <email> <archivo-salida>");
  process.exit(1);
}
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Falta FIRESTORE_EMULATOR_HOST: usa --env-file=.env.emulator-backup");
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-alaia";
const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const user = await auth.getUserByEmail(email).catch(() => null);
if (!user) {
  console.error(`No existe ${email} en el emulador.`);
  process.exit(1);
}

function encode(value) {
  if (value === null || value === undefined) return value;
  if (typeof value?.toMillis === "function") return { __timestamp: value.toMillis() };
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value)) result[key] = encode(item);
    return result;
  }
  return value;
}

async function exportDoc(ref) {
  const snapshot = await ref.get();
  const node = { id: ref.id, data: snapshot.exists ? encode(snapshot.data()) : null, collections: [] };
  const collections = await ref.listCollections();
  for (const collection of collections) {
    const docs = await collection.get();
    const children = [];
    for (const doc of docs.docs) children.push(await exportDoc(doc.ref));
    node.collections.push({ id: collection.id, docs: children });
  }
  return node;
}

const tenants = [];
const allTenants = await db.collection("tenants").get();
for (const tenantDoc of allTenants.docs) {
  const membership = await tenantDoc.ref.collection("memberships").doc(user.uid).get();
  if (!membership.exists) continue;
  tenants.push(await exportDoc(tenantDoc.ref));
}

const payload = {
  user: { uid: user.uid, email: user.email, displayName: user.displayName ?? null },
  tenants,
};
writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
console.log(`Exportado: ${email} con ${tenants.length} negocio(s) a ${outputPath}`);

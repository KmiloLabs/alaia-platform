// Paso 2: importa a Firestore real el JSON exportado del emulador y crea la cuenta.
// Uso: node --env-file=.env.real scripts/import-tenant-to-real.mjs <archivo> <password-temporal>
// IMPORTANTE: ejecutar solo con configuración real (sin variables de emulador).

import { readFileSync } from "node:fs";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const inputPath = process.argv[2];
const password = process.argv[3];
if (!inputPath || !password) {
  console.error("Uso: node scripts/import-tenant-to-real.mjs <archivo> <password-temporal>");
  process.exit(1);
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Hay variables de emulador en el entorno: aborta para no escribir en el emulador.");
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID || "alaia-3f637";
const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const payload = JSON.parse(readFileSync(inputPath, "utf8"));

function decode(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && typeof value.__timestamp === "number") {
    return Timestamp.fromMillis(value.__timestamp);
  }
  if (Array.isArray(value)) return value.map(decode);
  if (typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value)) result[key] = decode(item);
    return result;
  }
  return value;
}

async function importNode(node, ref) {
  if (node.data) await ref.set(decode(node.data));
  let count = node.data ? 1 : 0;
  for (const collection of node.collections) {
    for (const child of collection.docs) {
      count += await importNode(child, ref.collection(collection.id).doc(child.id));
    }
  }
  return count;
}

const { user } = payload;
const existing = await auth.getUserByEmail(user.email).catch(() => null);
if (existing) {
  await auth.updateUser(existing.uid, { password });
  console.log(`Cuenta existente actualizada: ${user.email}`);
} else {
  await auth.createUser({
    uid: user.uid,
    email: user.email,
    password,
    displayName: user.displayName ?? undefined,
    emailVerified: true,
  });
  console.log(`Cuenta creada: ${user.email}`);
}

const tenantIds = [];
for (const tenant of payload.tenants) {
  const ref = db.collection("tenants").doc(tenant.id);
  const docs = await importNode(tenant, ref);
  const slug = tenant.data?.slug;
  if (slug) await db.collection("tenantSlugs").doc(slug).set({ tenantId: tenant.id, importedAt: Timestamp.now() });
  tenantIds.push(tenant.id);
  console.log(`Negocio "${tenant.data?.name ?? tenant.id}" importado (${docs} documentos).`);
}

if (tenantIds.length > 0) {
  await db.collection("users").doc(user.uid).set(
    { tenantIds, updatedAt: Timestamp.now() },
    { merge: true },
  );
}

console.log("Importación terminada.");

// Borra los negocios de los que es dueño un correo, sin borrar la cuenta.
// Uso: node scripts/cleanup-tenant-by-owner-email.mjs <correo> [--apply]
// Sin --apply solo muestra lo que haría (simulación).

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
const apply = process.argv.includes("--apply");
const projectId = process.env.FIREBASE_PROJECT_ID || "demo-alaia";

if (!email) {
  console.error("Uso: node scripts/cleanup-tenant-by-owner-email.mjs <correo> [--apply]");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();

const user = await auth.getUserByEmail(email).catch(() => null);
if (!user) {
  console.log(`No existe una cuenta con el correo ${email}.`);
  process.exit(0);
}
console.log(`Cuenta: ${email} (uid ${user.uid})`);

const memberships = await db.collectionGroup("memberships").where("userId", "==", user.uid).get();
if (memberships.empty) {
  console.log("Esa cuenta no pertenece a ningún negocio. Nada que borrar.");
  process.exit(0);
}

for (const membershipDoc of memberships.docs) {
  const tenantRef = membershipDoc.ref.parent.parent;
  const tenantId = tenantRef.id;
  const tenantSnapshot = await tenantRef.get();
  const tenant = tenantSnapshot.data() ?? {};
  const membership = membershipDoc.data() ?? {};
  console.log(`- Negocio "${tenant.name ?? tenantId}" (${tenantId}), rol ${membership.role}`);

  if (!apply) continue;

  if (tenant.slug) {
    await db.collection("tenantSlugs").doc(tenant.slug).delete();
  }
  await db.recursiveDelete(tenantRef);
  console.log(`  borrado con sus citas, clientes, servicios, agentes y eventos.`);
}

if (!apply) {
  console.log("\nSimulación. Ejecuta de nuevo con --apply para borrar.");
} else {
  console.log("\nListo. La cuenta sigue existiendo como usuario de la plataforma.");
}

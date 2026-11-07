// Crea los índices de Firestore que Alaia necesita (alcance COLLECTION_GROUP).
// Uso: GOOGLE_APPLICATION_CREDENTIALS=... node --env-file=.env scripts/ensure-firestore-indexes.mjs
// Es idempotente: si el índice ya existe, no hace nada.

import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const projectId = process.env.FIREBASE_PROJECT_ID || "alaia-3f637";
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialsPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de la cuenta de servicio.");
  process.exit(1);
}

const credentials = JSON.parse(readFileSync(credentialsPath, "utf8"));
const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();
const { token } = await client.getAccessToken();

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const INDEXES = [
  { collectionGroup: "memberships", field: "userId" },
  { collectionGroup: "invitations", field: "tokenHash" },
  { collectionGroup: "reminders", field: "status" },
];

async function listIndexes(collectionGroup) {
  const response = await fetch(`${base}/collectionGroups/${collectionGroup}/indexes`, { headers });
  if (!response.ok) throw new Error(`No se pudieron listar índices de ${collectionGroup}: ${response.status}`);
  const data = await response.json();
  return data.indexes ?? [];
}

async function createIndex(collectionGroup, field) {
  const existing = await listIndexes(collectionGroup);
  const hasIndex = existing.some((index) =>
    (index.fields ?? []).some((item) => item.fieldPath === field) &&
    (index.queryScope === "COLLECTION_GROUP"));
  if (hasIndex) {
    console.log(`- ${collectionGroup}.${field}: ya existe`);
    return;
  }
  const body = {
    queryScope: "COLLECTION_GROUP",
    fields: [{ fieldPath: field, order: "ASCENDING" }],
  };
  const response = await fetch(`${base}/collectionGroups/${collectionGroup}/indexes`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`No se pudo crear ${collectionGroup}.${field}: ${response.status} ${detail.slice(0, 300)}`);
  }
  const created = await response.json();
  console.log(`- ${collectionGroup}.${field}: creando (${created.name?.split("/").pop() ?? "ok"})`);
}

for (const index of INDEXES) {
  await createIndex(index.collectionGroup, index.field);
}

console.log("\nLos índices nuevos tardan unos minutos en quedar READY. Este script se puede repetir.");

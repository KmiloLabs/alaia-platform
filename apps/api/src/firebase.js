import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

if (!projectId) {
  throw new Error("FIREBASE_PROJECT_ID is required. Use a separate Alaia project or the local emulator; never use Novara's project.");
}

// En local: GOOGLE_APPLICATION_CREDENTIALS (archivo) o emulador.
// En hosting: la cuenta de servicio va en una variable de entorno, en base64
// (recomendado) o como JSON plano.
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

function readServiceAccount() {
  if (serviceAccountBase64) {
    return JSON.parse(Buffer.from(serviceAccountBase64, "base64").toString("utf8"));
  }
  if (serviceAccountJson) return JSON.parse(serviceAccountJson);
  return null;
}

const serviceAccount = readServiceAccount();
const credential = serviceAccount ? cert(serviceAccount) : applicationDefault();

const firebaseApp = getApps()[0] ?? initializeApp({
  credential,
  projectId,
});

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

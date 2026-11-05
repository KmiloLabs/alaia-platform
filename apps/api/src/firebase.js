import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

if (!projectId) {
  throw new Error("FIREBASE_PROJECT_ID is required. Use a separate Alaia project or the local emulator; never use Novara's project.");
}

const firebaseApp = getApps()[0] ?? initializeApp({
  credential: applicationDefault(),
  projectId,
});

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

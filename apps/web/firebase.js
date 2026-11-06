import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

// Dos modos:
// - Local (por defecto): proyecto ficticio "demo-alaia" contra el emulador de Auth.
// - Real: cuando se definen las variables VITE_FIREBASE_* en el build, usa el
//   proyecto real de Alaia y NO conecta el emulador.
const realConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const demoConfig = {
  apiKey: "demo-alaia-local",
  authDomain: "demo-alaia.firebaseapp.com",
  projectId: "demo-alaia",
  storageBucket: "demo-alaia.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:alaia-local",
};

const useRealProject = Boolean(realConfig.apiKey && realConfig.projectId);
const firebaseConfig = useRealProject ? realConfig : demoConfig;

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// En local, el panel trabaja contra el emulador de Auth.
// connectAuthEmulator debe ejecutarse antes de la primera operación de Auth.
if (!useRealProject) {
  const authEmulatorUrl = import.meta.env.VITE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099";
  connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
}

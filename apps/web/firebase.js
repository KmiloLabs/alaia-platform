import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

// Proyecto Firebase ficticio del entorno local. Nunca se usa el proyecto real.
const firebaseConfig = {
  apiKey: "demo-alaia-local",
  authDomain: "demo-alaia.firebaseapp.com",
  projectId: "demo-alaia",
  storageBucket: "demo-alaia.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:alaia-local",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// El panel de este corte trabaja siempre contra el emulador de Auth local.
// connectAuthEmulator debe ejecutarse antes de la primera operación de Auth.
const authEmulatorUrl = import.meta.env.VITE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099";
connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });

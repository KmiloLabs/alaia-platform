// Cifrado de las claves de proveedores de IA con AES-256-GCM.
// La clave de cifrado (PLATFORM_SECRET) se lee en cada llamada, nunca al
// importar el módulo, y jamás se devuelve ni se escribe en logs.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SECRET_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;
const CIPHER_PATTERN = /^v1:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)$/;

// Devuelve la clave de 32 bytes o null si PLATFORM_SECRET falta o no son 64 hex.
export function readPlatformSecret(env = process.env) {
  const raw = typeof env?.PLATFORM_SECRET === "string" ? env.PLATFORM_SECRET.trim() : "";
  if (!SECRET_HEX_PATTERN.test(raw)) return null;
  return Buffer.from(raw, "hex");
}

export function encryptProviderKey(plainText, env = process.env) {
  const key = readPlatformSecret(env);
  if (!key) return { ok: false, code: "platform_secret_missing" };
  if (typeof plainText !== "string" || plainText === "") {
    return { ok: false, code: "invalid_api_key" };
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ok: true,
    value: `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`,
  };
}

export function decryptProviderKey(encoded, env = process.env) {
  const key = readPlatformSecret(env);
  if (!key) return { ok: false, code: "platform_secret_missing" };
  if (typeof encoded !== "string") return { ok: false, code: "invalid_ciphertext" };

  const match = CIPHER_PATTERN.exec(encoded.trim());
  if (!match) return { ok: false, code: "invalid_ciphertext" };

  try {
    const iv = Buffer.from(match[1], "base64");
    const tag = Buffer.from(match[2], "base64");
    const data = Buffer.from(match[3], "base64");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || data.length === 0) {
      return { ok: false, code: "invalid_ciphertext" };
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plainText = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    if (plainText === "") return { ok: false, code: "invalid_ciphertext" };
    return { ok: true, value: plainText };
  } catch {
    return { ok: false, code: "invalid_ciphertext" };
  }
}

// Solo se muestra el final de la clave: "…" + últimos 4 caracteres.
export function maskProviderKey(apiKey) {
  if (typeof apiKey !== "string" || apiKey === "") return null;
  return `…${apiKey.slice(-4)}`;
}

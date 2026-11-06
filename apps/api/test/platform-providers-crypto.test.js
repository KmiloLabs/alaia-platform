import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptProviderKey,
  encryptProviderKey,
  maskProviderKey,
  readPlatformSecret,
} from "../src/platform-providers-crypto.js";

const SECRET_ENV = { PLATFORM_SECRET: "0123456789abcdef".repeat(4) };
const OTHER_SECRET_ENV = { PLATFORM_SECRET: "fedcba9876543210".repeat(4) };
const API_KEY = "sk-prueba-1234567890";

test("ida y vuelta con AES-256-GCM", () => {
  const encrypted = encryptProviderKey(API_KEY, SECRET_ENV);
  assert.equal(encrypted.ok, true);
  assert.match(encrypted.value, /^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  assert.equal(encrypted.value.includes(API_KEY), false);

  const decrypted = decryptProviderKey(encrypted.value, SECRET_ENV);
  assert.equal(decrypted.ok, true);
  assert.equal(decrypted.value, API_KEY);

  // Dos cifrados de la misma clave son distintos (IV aleatorio).
  const second = encryptProviderKey(API_KEY, SECRET_ENV);
  assert.notEqual(second.value, encrypted.value);
});

test("con una clave incorrecta no descifra", () => {
  const encrypted = encryptProviderKey(API_KEY, SECRET_ENV);
  const decrypted = decryptProviderKey(encrypted.value, OTHER_SECRET_ENV);
  assert.equal(decrypted.ok, false);
  assert.equal(decrypted.code, "invalid_ciphertext");
});

test("un texto cifrado alterado no descifra", () => {
  const encrypted = encryptProviderKey(API_KEY, SECRET_ENV);
  const parts = encrypted.value.split(":");
  // Alterar el tag de autenticación debe romper GCM.
  parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  const decrypted = decryptProviderKey(parts.join(":"), SECRET_ENV);
  assert.equal(decrypted.ok, false);
  assert.equal(decrypted.code, "invalid_ciphertext");
});

test("formato inválido se rechaza", () => {
  for (const value of ["", "hola", "v1:abc", "v2:a:b:c", "v1:AAAA:BBBB", 42, null]) {
    const decrypted = decryptProviderKey(value, SECRET_ENV);
    assert.equal(decrypted.ok, false, String(value));
    assert.equal(decrypted.code, "invalid_ciphertext", String(value));
  }
});

test("sin PLATFORM_SECRET no se cifra ni descifra", () => {
  const encrypt = encryptProviderKey(API_KEY, {});
  assert.equal(encrypt.ok, false);
  assert.equal(encrypt.code, "platform_secret_missing");

  const encrypted = encryptProviderKey(API_KEY, SECRET_ENV);
  const decrypt = decryptProviderKey(encrypted.value, {});
  assert.equal(decrypt.ok, false);
  assert.equal(decrypt.code, "platform_secret_missing");
});

test("readPlatformSecret exige exactamente 64 hex", () => {
  assert.equal(readPlatformSecret({ PLATFORM_SECRET: "0123456789abcdef" }), null);
  assert.equal(readPlatformSecret({ PLATFORM_SECRET: "no-es-hex".repeat(8) }), null);
  assert.equal(readPlatformSecret({}), null);
  const key = readPlatformSecret(SECRET_ENV);
  assert.equal(Buffer.isBuffer(key), true);
  assert.equal(key.length, 32);
});

test("maskProviderKey solo deja los últimos 4 caracteres", () => {
  assert.equal(maskProviderKey("sk-prueba-1234567890"), "…7890");
  assert.equal(maskProviderKey(""), null);
  assert.equal(maskProviderKey(null), null);
});

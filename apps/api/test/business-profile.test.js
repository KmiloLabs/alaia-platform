import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveBusinessProfile,
  validateBusinessProfileInput,
} from "../src/business-profile.js";

const VALID_PROFILE = {
  description: "Barbería con estilo, en el centro de Bogotá.",
  address: "Calle 45 #12-30, Bogotá",
  phone: "+57 (601) 234-5678",
  socialLinks: {
    instagram: "https://instagram.com/barberia",
    facebook: "https://facebook.com/barberia",
    tiktok: "",
    whatsapp: "300 123 4567",
    website: "https://barberia.example.com",
  },
};

test("valida un perfil completo y normaliza el whatsapp", () => {
  const result = validateBusinessProfileInput(VALID_PROFILE);
  assert.equal(result.ok, true);
  assert.equal(result.hasAny, true);
  assert.deepEqual(result.value, {
    description: "Barbería con estilo, en el centro de Bogotá.",
    address: "Calle 45 #12-30, Bogotá",
    phone: "+57 (601) 234-5678",
    socialLinks: {
      instagram: "https://instagram.com/barberia",
      facebook: "https://facebook.com/barberia",
      tiktok: "",
      whatsapp: "3001234567",
      website: "https://barberia.example.com",
    },
  });
});

test("acepta perfiles parciales y redes vacías", () => {
  const partial = validateBusinessProfileInput({ description: "  Hola  " });
  assert.equal(partial.ok, true);
  assert.equal(partial.hasAny, true);
  assert.deepEqual(partial.value, { description: "Hola" });

  const empty = validateBusinessProfileInput({ socialLinks: { instagram: "", whatsapp: "" } });
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.value.socialLinks, { instagram: "", whatsapp: "" });

  const nothing = validateBusinessProfileInput({ name: "otro campo" });
  assert.equal(nothing.ok, true);
  assert.equal(nothing.hasAny, false);
  assert.deepEqual(nothing.value, {});
});

test("códigos de error de descripción, dirección y teléfono", () => {
  const cases = [
    ["invalid_description", { description: "x".repeat(301) }],
    ["invalid_description", { description: 42 }],
    ["invalid_address", { address: "x".repeat(201) }],
    ["invalid_address", { address: 42 }],
    ["invalid_phone", { phone: "x".repeat(31) }],
    ["invalid_phone", { phone: "601 234 5678 ext 12" }],
    ["invalid_phone", { phone: 6012345678 }],
  ];
  for (const [code, body] of cases) {
    const result = validateBusinessProfileInput(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.code, code, JSON.stringify(body));
  }
});

test("valida los enlaces sociales", () => {
  const cases = [
    [{ socialLinks: "instagram" }],
    [{ socialLinks: [] }],
    [{ socialLinks: { instagram: "instagram.com/barberia" } }],
    [{ socialLinks: { instagram: "http://instagram.com/barberia" } }],
    [{ socialLinks: { facebook: 42 } }],
    [{ socialLinks: { tiktok: "https://" } }],
    [{ socialLinks: { website: `https://x.com/${"a".repeat(110)}` } }],
    [{ socialLinks: { whatsapp: "123" } }],
    [{ socialLinks: { whatsapp: "1234567890123456" } }],
    [{ socialLinks: { whatsapp: "abc" } }],
    [{ socialLinks: { youtube: "https://youtube.com/x" } }],
  ];
  for (const [body] of cases) {
    const result = validateBusinessProfileInput(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.code, "invalid_social_link", JSON.stringify(body));
  }

  const valid = validateBusinessProfileInput({
    socialLinks: { instagram: "https://instagram.com/x", whatsapp: "+57 300 123 4567" },
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.socialLinks.whatsapp, "573001234567");
});

test("resuelve el perfil con defaults para tenants antiguos", () => {
  assert.deepEqual(resolveBusinessProfile({}), {
    description: "",
    address: "",
    phone: "",
    socialLinks: { instagram: "", facebook: "", tiktok: "", whatsapp: "", website: "" },
  });
  assert.deepEqual(
    resolveBusinessProfile({
      description: "Descripción",
      address: "Calle 1",
      phone: "6012345678",
      socialLinks: { instagram: "https://instagram.com/x" },
    }),
    {
      description: "Descripción",
      address: "Calle 1",
      phone: "6012345678",
      socialLinks: { instagram: "https://instagram.com/x", facebook: "", tiktok: "", whatsapp: "", website: "" },
    },
  );
});

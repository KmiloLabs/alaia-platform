// Páginas legales públicas: lee docs/legal/*.md y las sirve como HTML.
// Los datos del responsable se toman de variables de entorno para no tocar código
// cuando el RUT esté listo (LEGAL_NAME, LEGAL_NIT, LEGAL_CITY, LEGAL_EMAIL).
import { Router } from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const legalDir = path.resolve(fileURLToPath(new URL("../../../docs/legal", import.meta.url)));

const PAGES = {
  privacidad: { file: "privacidad.md", title: "Política de Privacidad" },
  terminos: { file: "terminos.md", title: "Términos y Condiciones" },
  "tratamiento-datos": { file: "tratamiento-datos.md", title: "Tratamiento de Datos Personales" },
  "borrado-datos": { file: "borrado-datos.md", title: "Borrado de Datos" },
};

function legalData() {
  const name = process.env.LEGAL_NAME?.trim() || "Alaia";
  const nit = process.env.LEGAL_NIT?.trim() || "en trámite";
  const city = process.env.LEGAL_CITY?.trim() || "Medellín";
  const email = process.env.LEGAL_EMAIL?.trim() || "automatizacionsaas@gmail.com";
  return { name, nit, city, email };
}

function fillPlaceholders(markdown) {
  const { name, nit, city, email } = legalData();
  return markdown
    .replaceAll("[RAZÓN SOCIAL]", name)
    .replaceAll("[NIT]", nit)
    .replaceAll("[CIUDAD, COLOMBIA]", `${city}, Colombia`)
    .replaceAll("[CIUDAD]", city)
    .replaceAll("[correo de privacidad]", email)
    .replaceAll("[correo de soporte]", email)
    .replaceAll("[teléfono]", email)
    .replaceAll("[dirección]", `${city}, Colombia`);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inline(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  return html;
}

// Conversor mínimo para el subconjunto de Markdown que usan los documentos.
function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let listType = null;
  const closeList = () => {
    if (listType) out.push(`</${listType}>`);
    listType = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === "") {
      closeList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\|/.test(trimmed)) {
      closeList();
      const rows = [];
      while (index < lines.length && /^\|/.test(lines[index].trim())) {
        rows.push(lines[index].trim());
        index += 1;
      }
      index -= 1;
      const cells = (row) => row.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const header = cells(rows[0]);
      const body = rows.slice(1).filter((row) => !/^\|?\s*:?-{2,}/.test(row.replace(/\s/g, "")) || !/^[\s|:-]+$/.test(row));
      out.push("<table><thead><tr>");
      for (const cell of header) out.push(`<th>${inline(cell)}</th>`);
      out.push("</tr></thead><tbody>");
      for (const row of body) {
        if (/^[\s|:-]+$/.test(row)) continue;
        out.push("<tr>");
        for (const cell of cells(row)) out.push(`<td>${inline(cell)}</td>`);
        out.push("</tr>");
      }
      out.push("</tbody></table>");
      continue;
    }

    const unordered = /^[-*]\s+(.*)$/.exec(trimmed);
    const ordered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (unordered || ordered) {
      const wanted = unordered ? "ul" : "ol";
      if (listType !== wanted) {
        closeList();
        out.push(`<${wanted}>`);
        listType = wanted;
      }
      out.push(`<li>${inline((unordered ?? ordered)[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(trimmed)}</p>`);
  }
  closeList();
  return out.join("\n");
}

function pageShell(title, bodyHtml) {
  const { name, city, email } = legalData();
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · ${name}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f6f4ef; color: #24312f; line-height: 1.65; }
  main { max-width: 820px; margin: 0 auto; padding: 48px 24px 80px; }
  h1 { font-size: 1.9rem; letter-spacing: -0.02em; margin: 0 0 4px; }
  h2 { font-size: 1.25rem; margin-top: 2rem; }
  h3 { font-size: 1.05rem; margin-top: 1.5rem; }
  p, li { font-size: 0.98rem; }
  a { color: #0f6b5c; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.92rem; }
  th, td { border: 1px solid #d8d2c4; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #ece7db; }
  code { background: #ece7db; padding: 1px 5px; border-radius: 4px; }
  footer { margin-top: 3rem; font-size: 0.85rem; color: #5d6b68; border-top: 1px solid #d8d2c4; padding-top: 1rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #121a18; color: #e7efe9; }
    a { color: #7fd8c5; }
    th { background: #1d2a27; }
    th, td { border-color: #2b3a36; }
    code { background: #1d2a27; }
    footer { color: #9fb0ab; border-color: #2b3a36; }
  }
</style>
</head>
<body>
<main>
${bodyHtml}
<footer>${name} · ${city}, Colombia · ${email} · <a href="/legal">Todos los documentos legales</a></footer>
</main>
</body>
</html>`;
}

export const legalRoutes = Router();

legalRoutes.get("/legal", (_req, res) => {
  const items = Object.entries(PAGES)
    .map(([slug, page]) => `<li><a href="/legal/${slug}">${page.title}</a></li>`)
    .join("");
  res.type("html").send(pageShell("Documentos legales", `<h1>Documentos legales</h1><ul>${items}</ul>`));
});

legalRoutes.get("/legal/:slug", (req, res) => {
  const page = PAGES[req.params.slug];
  if (!page) {
    res.status(404).type("html").send(pageShell("No encontrado", "<h1>Documento no encontrado</h1>"));
    return;
  }
  const filePath = path.join(legalDir, page.file);
  if (!existsSync(filePath)) {
    res.status(404).type("html").send(pageShell("No encontrado", "<h1>Documento no disponible</h1>"));
    return;
  }
  const markdown = fillPlaceholders(readFileSync(filePath, "utf8"));
  res.type("html").send(pageShell(page.title, markdownToHtml(markdown)));
});

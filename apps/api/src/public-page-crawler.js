// Página pública renderizada en el servidor para rastreadores (Meta, Google,
// WhatsApp, etc.). La app sigue siendo una SPA para personas; esto solo alimenta
// a los bots con contenido real del negocio (nombre, dirección, servicios).
import { resolveBusinessProfile } from "./business-profile.js";
import { listServices } from "./service-catalog.js";
import { serviceRepository } from "./service-repository.js";

export function isCrawlerUserAgent(userAgent) {
  return /facebookexternalhit|facebookcatalog|whatsapp|twitterbot|googlebot|bingbot|linkedinbot|slackbot|discordbot|telegrambot|pinterest/i.test(
    String(userAgent ?? ""),
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatPrice(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "";
  return `$${value.toLocaleString("es-CO")}`;
}

export async function buildPublicPageForCrawler({ tenant, slug, services, appOrigin }) {
  const profile = resolveBusinessProfile(tenant);
  const activeServices = (services ?? []).filter((service) => service.active !== false).slice(0, 12);
  const title = `${tenant.name} — Reserva tu cita`;
  const description = [
    `${tenant.name}${profile.businessAddress ? `, ${profile.businessAddress}` : ""}.`,
    activeServices.length
      ? `Servicios: ${activeServices.slice(0, 6).map((service) => service.name).join(", ")}.`
      : "",
    "Reserva en línea.",
  ].filter(Boolean).join(" ").slice(0, 300);

  const offers = activeServices.map((service) => ({
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: service.name,
      ...(service.durationMinutes ? { estimatedDuration: `PT${service.durationMinutes}M` } : {}),
    },
    ...(service.priceCOP ? { price: String(service.priceCOP), priceCurrency: "COP" } : {}),
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: tenant.name,
    url: `${appOrigin}/b/${slug}`,
    ...(profile.businessAddress ? { address: { "@type": "PostalAddress", streetAddress: profile.businessAddress } } : {}),
    ...(profile.businessPhone ? { telephone: profile.businessPhone } : {}),
    ...(profile.socialLinks?.instagram ? { sameAs: [profile.socialLinks.instagram] } : {}),
    ...(offers.length ? { makesOffer: offers } : {}),
  };

  const rows = activeServices
    .map((service) => `<li><strong>${escapeHtml(service.name)}</strong>${service.durationMinutes ? ` · ${Number(service.durationMinutes)} min` : ""}${service.priceCOP ? ` · ${formatPrice(service.priceCOP)}` : ""}</li>`)
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="business.business" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(`${appOrigin}/b/${slug}`)}" />
<link rel="canonical" href="${escapeHtml(`${appOrigin}/b/${slug}`)}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<main>
<h1>${escapeHtml(tenant.name)}</h1>
${profile.businessAddress ? `<p>${escapeHtml(profile.businessAddress)}</p>` : ""}
${profile.businessPhone ? `<p>Teléfono: ${escapeHtml(profile.businessPhone)}</p>` : ""}
<h2>Servicios</h2>
<ul>${rows || "<li>Consulta nuestros servicios en la página de reservas.</li>"}</ul>
<p><a href="${escapeHtml(`${appOrigin}/b/${slug}`)}">Reservar cita</a></p>
</main>
</body>
</html>`;
}

export async function loadPublicTenantForCrawler({ db, slug }) {
  const slugSnapshot = await db.collection("tenantSlugs").doc(slug).get();
  if (!slugSnapshot.exists) return null;
  const tenantId = slugSnapshot.data()?.tenantId;
  if (!tenantId) return null;
  const tenantSnapshot = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnapshot.exists) return null;
  const tenant = { id: tenantId, ...tenantSnapshot.data() };
  const { services } = await listServices({ tenantId, repository: serviceRepository });
  return { tenant, services };
}

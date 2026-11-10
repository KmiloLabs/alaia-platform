import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tenantRoutes } from "./tenant-routes.js";
import { appointmentRoutes } from "./appointment-routes.js";
import { serviceRoutes } from "./service-routes.js";
import { customerRoutes } from "./customer-routes.js";
import { dashboardRoutes } from "./dashboard-routes.js";
import { professionalRoutes } from "./professional-routes.js";
import { settlementRoutes } from "./settlement-routes.js";
import { invitationRoutes, publicInvitationRoutes } from "./invitation-routes.js";
import { publicRoutes } from "./public-routes.js";
import { reminderRoutes, reminderTaskRoutes } from "./reminder-routes.js";
import { conversationRoutes } from "./conversation-routes.js";
import { whatsappRoutes, whatsappPlatformRoutes, whatsappWebhookRoutes } from "./whatsapp-routes.js";
import { agentRoutes } from "./agent/routes.js";
import { platformRoutes } from "./platform-routes.js";
import { sendError } from "./http.js";
import { legalRoutes } from "./legal.js";

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const allowedOrigins = new Set(
  (process.env.ALLOWED_WEB_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");

  const origin = req.get("origin");
  if (origin) {
    // Mismo origen (panel servido por la API): se permite siempre.
    const ownOrigin = `${req.protocol}://${req.get("host")}`;
    if (!allowedOrigins.has(origin) && origin !== ownOrigin) {
      return sendError(res, 403, "origin_not_allowed", "Origen no permitido.");
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
  }
  return next();
});
// El webhook necesita el cuerpo CRUDO para verificar la firma: va antes de json.
app.use("/api/v1", whatsappWebhookRoutes);
app.use(express.json({ limit: "32kb", strict: true }));
app.use("/api/v1", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  return next();
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "alaia-api" }));
// Documentos legales públicos (Meta exige una URL de privacidad).
app.use(legalRoutes);
// Las rutas públicas van antes de los routers autenticados: esos routers aplican
// requireUser como middleware global del montaje y si no, interceptarían 401.
app.use("/api/v1", publicRoutes);
app.use("/api/v1", publicInvitationRoutes);
app.use("/api/v1", reminderTaskRoutes);
app.use("/api/v1", tenantRoutes);
app.use("/api/v1", appointmentRoutes);
app.use("/api/v1", serviceRoutes);
app.use("/api/v1", customerRoutes);
app.use("/api/v1", dashboardRoutes);
app.use("/api/v1", professionalRoutes);
app.use("/api/v1", settlementRoutes);
app.use("/api/v1", invitationRoutes);
app.use("/api/v1", whatsappRoutes);
app.use("/api/v1", conversationRoutes);
app.use("/api/v1", reminderRoutes);
app.use("/api/v1", whatsappPlatformRoutes);
app.use("/api/v1", agentRoutes);
app.use("/api/v1", platformRoutes);
// Panel compilado: en producción un solo servicio sirve la API y el panel.
const webDist = path.resolve(fileURLToPath(new URL("../../web/dist", import.meta.url)));
if (existsSync(path.join(webDist, "index.html"))) {
  app.use(express.static(webDist, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    return res.sendFile(path.join(webDist, "index.html"));
  });
}

app.use((_req, res) => sendError(res, 404, "not_found", "No encontramos esa ruta."));
app.use((error, _req, res, _next) => {
  const status = Number(error.status || error.statusCode || 500);
  if (status >= 500) console.error("api_error", { name: error.name, code: error.code });
  return sendError(res, status, status >= 500 ? "internal_error" : "invalid_request", status >= 500 ? "Ocurrió un error. Intenta de nuevo." : "La solicitud no es válida.");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Alaia API listening on port ${port}`);
});

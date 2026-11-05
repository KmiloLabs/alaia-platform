import express from "express";
import { tenantRoutes } from "./tenant-routes.js";
import { sendError } from "./http.js";

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const allowedOrigins = new Set(
  (process.env.ALLOWED_WEB_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");

  const origin = req.get("origin");
  if (origin) {
    if (!allowedOrigins.has(origin)) return sendError(res, 403, "origin_not_allowed", "Origen no permitido.");
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
  }
  return next();
});
app.use(express.json({ limit: "32kb", strict: true }));
app.use("/api/v1", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  return next();
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "alaia-api" }));
app.use("/api/v1", tenantRoutes);
app.use((_req, res) => sendError(res, 404, "not_found", "No encontramos esa ruta."));
app.use((error, _req, res, _next) => {
  const status = Number(error.status || error.statusCode || 500);
  if (status >= 500) console.error("api_error", { name: error.name, code: error.code });
  return sendError(res, status, status >= 500 ? "internal_error" : "invalid_request", status >= 500 ? "Ocurrió un error. Intenta de nuevo." : "La solicitud no es válida.");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Alaia API listening on port ${port}`);
});

// Limitador de peticiones en memoria (sin dependencias). Ventana fija por clave.
// Se exporta la fábrica pura para probarlo con un reloj inyectable.

export function createRateLimiter({ limit, windowMs, maxKeys = 10_000 } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit inválido");
  if (!Number.isInteger(windowMs) || windowMs < 1) throw new RangeError("windowMs inválido");

  const buckets = new Map();

  return {
    consume(key, nowMs = Date.now()) {
      const now = Number(nowMs);
      let bucket = buckets.get(key);
      if (!bucket || now - bucket.windowStart >= windowMs) {
        bucket = { windowStart: now, count: 0 };
        buckets.set(key, bucket);
      }

      if (bucket.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(0, bucket.windowStart + windowMs - now),
        };
      }

      bucket.count += 1;
      if (buckets.size > maxKeys) cleanup(now);
      return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
    },
    reset() {
      buckets.clear();
    },
    size() {
      return buckets.size;
    },
  };

  function cleanup(now) {
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.windowStart >= windowMs) buckets.delete(key);
    }
  }
}

// Middleware Express con reloj inyectable (por defecto Date.now).
export function createRateLimitMiddleware({ limiter, keyFn, now = () => Date.now(), message }) {
  return (req, res, next) => {
    const result = limiter.consume(keyFn(req), now());
    if (result.allowed) return next();
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
    return res.status(429).json({
      error: {
        code: "too_many_requests",
        message: message ?? "Demasiadas solicitudes. Intenta de nuevo en un momento.",
      },
    });
  };
}

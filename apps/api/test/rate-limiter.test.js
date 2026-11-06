import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimitMiddleware, createRateLimiter } from "../src/rate-limiter.js";

test("permite hasta el límite y bloquea con retryAfter (reloj falso)", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
  assert.equal(limiter.consume("ip", 0).allowed, true);
  assert.equal(limiter.consume("ip", 100).allowed, true);
  assert.equal(limiter.consume("ip", 200).allowed, true);

  const blocked = limiter.consume("ip", 300);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 700);
  assert.equal(limiter.consume("ip", 999).allowed, false);

  // Al reiniciarse la ventana vuelve a permitir.
  assert.equal(limiter.consume("ip", 1000).allowed, true);
});

test("las claves son independientes", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
  assert.equal(limiter.consume("1.1.1.1:slug-a", 0).allowed, true);
  assert.equal(limiter.consume("1.1.1.1:slug-a", 1).allowed, false);
  assert.equal(limiter.consume("1.1.1.1:slug-b", 1).allowed, true);
  assert.equal(limiter.consume("2.2.2.2:slug-a", 1).allowed, true);
});

test("reservas: 10 por hora por IP+slug y la 11 se bloquea", () => {
  const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });
  const start = Date.parse("2026-11-06T15:00:00.000Z");
  for (let index = 0; index < 10; index += 1) {
    const result = limiter.consume("127.0.0.1:barberia", start + index * 1000);
    assert.equal(result.allowed, true, `intento ${index + 1}`);
  }
  const blocked = limiter.consume("127.0.0.1:barberia", start + 10_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);

  // Otra IP o otro slug no está limitado.
  assert.equal(limiter.consume("127.0.0.2:barberia", start + 10_000).allowed, true);
  assert.equal(limiter.consume("127.0.0.1:otra-barberia", start + 10_000).allowed, true);

  // A la hora siguiente se libera.
  assert.equal(limiter.consume("127.0.0.1:barberia", start + 3_600_000).allowed, true);
});

test("reset limpia los contadores", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
  assert.equal(limiter.consume("ip", 0).allowed, true);
  assert.equal(limiter.consume("ip", 1).allowed, false);
  limiter.reset();
  assert.equal(limiter.consume("ip", 2).allowed, true);
});

test("middleware devuelve 429 too_many_requests", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
  const middleware = createRateLimitMiddleware({
    limiter,
    keyFn: () => "ip",
    now: () => 1000,
  });
  const headers = {};
  const res = {
    statusCode: 0,
    body: null,
    setHeader(name, value) { headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };

  let nextCalled = 0;
  middleware({}, res, () => { nextCalled += 1; });
  assert.equal(nextCalled, 1);

  middleware({}, res, () => { nextCalled += 1; });
  assert.equal(nextCalled, 1);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body?.error?.code, "too_many_requests");
  assert.equal(headers["Retry-After"], "60");
});

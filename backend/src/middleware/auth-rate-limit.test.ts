import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";

import { authRateLimiter } from "./auth-rate-limit.js";

test("authentication rate limiter blocks the eleventh request in its window", async () => {
  const app = express();
  app.post("/resend", authRateLimiter, (_req, res) => {
    res.status(202).json({ success: true });
  });
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/resend`,
        { method: "POST" },
      );
      statuses.push(response.status);
    }

    assert.equal(statuses.slice(0, 10).every((status) => status === 202), true);
    assert.equal(statuses[10], 429);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

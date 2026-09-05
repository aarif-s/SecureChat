import assert from "node:assert/strict";
import test, { mock } from "node:test";

process.env.UPSTASH_REDIS_REST_URL ??= "https://redis.example";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-token";
process.env.GOOGLE_CLIENT_ID ??= "google-client-id";

const {
  completeGoogleAuthentication,
  startGoogleAuthentication,
  validateGoogleClaims,
  validateGoogleNonce,
} = await import("./google-auth.service.js");

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: "google-client-id",
    sub: "google-sub",
    email: "person@example.com",
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  } as never;
}

test("Google OAuth rejects missing, expired, and reused transactions", async () => {
  const getdel = mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ result: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await assert.rejects(
    completeGoogleAuthentication("invalid-state", new URL("https://api.example/callback")),
  );
  await assert.rejects(
    completeGoogleAuthentication("expired-state", new URL("https://api.example/callback")),
  );
  await assert.rejects(
    completeGoogleAuthentication("reused-state", new URL("https://api.example/callback")),
  );

  assert.equal(getdel.mock.callCount(), 3);
  mock.restoreAll();
});

test("Google OAuth start stores state, PKCE verifier, and nonce with expiry", async () => {
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const previousRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  process.env.GOOGLE_CLIENT_ID = "google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:5000/api/auth/google/callback";

  const stored: { key: string; value: unknown; options: unknown }[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);

    if (url.includes("accounts.google.com")) {
      return new Response(JSON.stringify({
        issuer: "https://accounts.google.com",
        authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        token_endpoint: "https://oauth2.googleapis.com/token",
        jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const parsedBody = JSON.parse(String(init?.body ?? "[]")) as unknown;
    const pipeline = Array.isArray(parsedBody) ? parsedBody : [];
    const command = Array.isArray(pipeline[0])
      ? pipeline[0] as string[]
      : pipeline as string[];
    if (command[0] === "set") {
      stored.push({
        key: command[1] ?? "",
        value: JSON.parse(command[2] ?? "null"),
        options: command.slice(3),
      });
    }

    return new Response(JSON.stringify(["OK"]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const result = await startGoogleAuthentication();
  const transaction = stored[0]?.value as {
    codeVerifier?: string;
    nonce?: string;
    redirectUri?: string;
  };

  assert.match(result.state, /^[A-Za-z0-9_-]+$/);
  assert.equal(stored[0]?.key, `oauth:google:${result.state}`);
  assert.equal(transaction.redirectUri, process.env.GOOGLE_REDIRECT_URI);
  assert.ok(transaction.codeVerifier);
  assert.ok(transaction.nonce);
  assert.deepEqual(stored[0]?.options, ["ex", 600]);
  assert.equal(result.authorizationUrl.searchParams.get("state"), result.state);
  assert.equal(result.authorizationUrl.searchParams.get("code_challenge_method"), "S256");
  assert.equal(result.authorizationUrl.searchParams.get("nonce"), transaction.nonce);

  process.env.GOOGLE_CLIENT_ID = previousClientId;
  process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
  process.env.GOOGLE_REDIRECT_URI = previousRedirectUri;
  assert.equal(fetchMock.mock.callCount() >= 2, true);
  mock.restoreAll();
});

for (const [label, overrides] of [
  ["issuer", { iss: "https://evil.example" }],
  ["audience", { aud: "another-client-id" }],
  ["expiry", { exp: Math.floor(Date.now() / 1000) - 1 }],
  ["email verification", { email_verified: false }],
] as const) {
  test(`Google ID token rejects invalid ${label}`, () => {
    assert.equal(validateGoogleClaims(validClaims(overrides)), false);
  });
}

test("Google ID token accepts verified identity claims", () => {
  assert.equal(validateGoogleClaims(validClaims()), true);
});

test("Google ID token rejects an invalid nonce", () => {
  const claims = validClaims({ nonce: "received-nonce" });

  assert.equal(validateGoogleNonce(claims, "expected-nonce"), false);
  assert.equal(validateGoogleNonce(claims, "received-nonce"), true);
});

# SecureChat Backend

Copy `.env.example` to `.env` and provide values for `MONGODB_URI`,
`UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. Set `CLIENT_URL` to
the browser application's origin. `PORT` defaults to `5000` when omitted.

Before starting the API, run:

```bash
npm run config:check
```

The check validates that required environment variables are present without
printing their values. To verify the configured Upstash Redis connection with a
non-mutating `PING`, run:

```bash
npm run redis:test
```

Start the development server with `npm run dev`.

## Server-side message encryption

Message content is encrypted at rest by the backend with AES-256-GCM. This is
server-side encryption, not end-to-end encryption: a fully compromised backend
with the encryption key can decrypt message content. TLS remains necessary for
protecting content in transit.

Set `MESSAGE_ENCRYPTION_ACTIVE_KEY_VERSION` and the matching
`MESSAGE_ENCRYPTION_KEY_V<version>` variable. Generate a 32-byte key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Each message uses a fresh random 12-byte IV and stores its key version. For key
rotation, add the new key alongside the old key, change the active version, and
run the migration explicitly. Existing plaintext messages remain readable
until migration; new messages are always encrypted.

Preview the migration without changing data:

```bash
npm run message-encryption:migrate -- --dry-run
```

Run it explicitly after reviewing the result:

```bash
npm run message-encryption:migrate
```

Encryption keys are server-side secrets. Never put them in MongoDB, Redis,
frontend code, logs, or API responses.

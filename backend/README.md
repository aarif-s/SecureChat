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

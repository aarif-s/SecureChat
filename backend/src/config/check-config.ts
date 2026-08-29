import "dotenv/config";

const requiredVariables = [
  "CLIENT_URL",
  "MONGODB_URI",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

const missingVariables = requiredVariables.filter(
  (name) => !process.env[name],
);

if (missingVariables.length > 0) {
  console.error(
    `Missing required environment variables: ${missingVariables.join(", ")}`,
  );
  process.exitCode = 1;
} else {
  console.log("Backend configuration is valid.");
}

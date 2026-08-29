import "dotenv/config";

import { redis } from "./redis.js";

async function verifyRedis(): Promise<void> {
  try {
    await redis.ping();
    console.log("Redis connection verified.");
  } catch {
    console.error("Redis connection verification failed.");
    process.exitCode = 1;
  }
}

void verifyRedis();

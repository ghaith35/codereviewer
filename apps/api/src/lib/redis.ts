import { Redis } from "ioredis";
import { env } from "../env.js";

const makeRedis = () =>
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

export const redis = makeRedis();      // general purpose + BullMQ jobs
export const redisPub = makeRedis();   // SSE publish
export const redisSub = makeRedis();   // SSE subscribe (separate connection required)

async function ensureConnected(client: Redis) {
  if (client.status === "ready") return;
  if (client.status === "connecting" || client.status === "connect") {
    await new Promise<void>((resolve, reject) => {
      client.once("ready", resolve);
      client.once("error", reject);
    });
    return;
  }
  await client.connect();
}

export async function connectRedis() {
  await Promise.all([ensureConnected(redis), ensureConnected(redisPub), ensureConnected(redisSub)]);
  const pong = await redis.ping();
  return pong === "PONG";
}

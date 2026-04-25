import { Redis } from "ioredis";
import { env } from "../env.js";

const makeRedis = (db = 0) =>
  new Redis(env.REDIS_URL, {
    db,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

export const redis = makeRedis(0);      // general purpose + BullMQ jobs
export const redisPub = makeRedis(1);   // SSE publish
export const redisSub = makeRedis(1);   // SSE subscribe (separate connection required)

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

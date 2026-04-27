import { Redis } from "ioredis";
import { env } from "../env.js";

const makeRedis = (name: string) => {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error(`[redis:${name}] error`, err.message);
  });

  return client;
};

export const redis = makeRedis("main");      // general purpose + BullMQ jobs
export const redisPub = makeRedis("pub");    // SSE publish
export const redisSub = makeRedis("sub");    // SSE subscribe (separate connection required)

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

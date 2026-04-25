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

export async function connectRedis() {
  await Promise.all([redis.connect(), redisPub.connect(), redisSub.connect()]);
  const pong = await redis.ping();
  return pong === "PONG";
}

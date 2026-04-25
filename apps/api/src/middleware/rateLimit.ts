import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../lib/redis.js";

const makeStore = () =>
  new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
  });

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  keyGenerator: (req: any) => req.user?.id ?? req.ip ?? "anon",
  message: { error: "rate_limited", message: "Too many requests, please slow down" },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  store: makeStore(),
  keyGenerator: (req) => req.ip ?? "anon",
  message: { error: "rate_limited", message: "Too many auth attempts" },
});

export const expensiveLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  store: makeStore(),
  keyGenerator: (req: any) => req.user?.id ?? req.ip ?? "anon",
  message: { error: "rate_limited", message: "Too many requests for this operation" },
});

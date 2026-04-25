import "./env.js";
import { env } from "./env.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectRedis } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";
import { startWorker } from "./workers/analyze.worker.js";
import { scheduleMonthlyReset } from "./workers/queue.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { globalLimiter, authLimiter, expensiveLimiter } from "./middleware/rateLimit.js";
import authRouter from "./routes/auth.js";
import reposRouter from "./routes/repos.js";
import analysesRouter from "./routes/analyses.js";
import dashboardRouter from "./routes/dashboard.js";

const app = express();

app.set("trust proxy", 1);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, origin.replace(/\/+$/, "") === env.FRONTEND_URL);
  },
  credentials: true,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
};

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(requestId);

app.use("/api", globalLimiter);
app.use("/api/auth", authLimiter);
app.post("/api/analyses", expensiveLimiter);
app.post("/api/repos/sync", expensiveLimiter);

app.use("/api/auth", authRouter);
app.use("/api/repos", reposRouter);
app.use("/api/analyses", analysesRouter);
app.use("/api/dashboard", dashboardRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: "not_found", message: "Route not found" });
});

app.use(errorHandler);

async function start() {
  await connectRedis();
  console.log("[redis] connected");

  // Recover analyses left in-flight by a previous crash
  const stale = await prisma.analysis.updateMany({
    where: {
      status: { in: ["FETCHING_FILES", "RUNNING_STATIC", "RUNNING_AI", "GENERATING_REPORT"] },
      updatedAt: { lt: new Date(Date.now() - 15 * 60_000) },
    },
    data: { status: "FAILED", errorMessage: "Worker crashed before completion" },
  });
  if (stale.count > 0) {
    console.log(`[boot] recovered ${stale.count} stale analysis(es)`);
  }

  await prisma.$connect();
  console.log("[db] connected");

  startWorker();
  scheduleMonthlyReset();

  app.listen(env.PORT, () => {
    console.log(`[api] listening on port ${env.PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

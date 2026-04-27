import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";
import type { AnalyzeJobData, AnalyzeJobResult } from "@cr/shared";

export const analyzeQueue = new Queue<AnalyzeJobData, AnalyzeJobResult>("analyze", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400, count: 1000 },
  },
});

analyzeQueue.on("error", (err) => {
  console.error("[queue] error", err);
});

// Schedule the monthly quota reset on the 1st of every month at midnight UTC.
// Idempotent: BullMQ deduplicates by jobId so calling this on every boot is safe.
export async function scheduleMonthlyReset() {
  await analyzeQueue.add(
    "monthly-quota-reset",
    {} as unknown as AnalyzeJobData,
    {
      repeat: { pattern: "0 0 1 * *" },
      jobId: "monthly-quota-reset",
    }
  );
  console.log("[queue] monthly quota reset scheduled");
}

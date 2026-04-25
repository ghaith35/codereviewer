import { QUOTA_FREE } from "@cr/shared";

export function canStartAnalysis(user: {
  plan: string;
  analysesUsedMtd: number;
}): { ok: true } | { ok: false; reason: string } {
  const limit = user.plan === "PRO" ? Infinity : QUOTA_FREE;
  if (user.analysesUsedMtd >= limit) {
    return { ok: false, reason: "quota_exceeded" };
  }
  return { ok: true };
}

export function canAnalyzePrivateRepo(user: { plan: string }): boolean {
  return user.plan === "PRO";
}

export function canExportBrandedPDF(user: { plan: string }): boolean {
  return user.plan === "PRO";
}

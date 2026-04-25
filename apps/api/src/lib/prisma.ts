import { PrismaClient } from "@prisma/client";

const base = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Mask the encrypted GitHub token so it never leaks into logs or accidental serialisation.
// When code explicitly selects githubTokenEnc (e.g. GitHubService.forUser), masking is bypassed.
export const prisma = base.$extends({
  query: {
    user: {
      async $allOperations({ args, query }) {
        const result = await query(args);
        const selectsToken = (args as any)?.select?.githubTokenEnc === true;
        if (!selectsToken) maskEncToken(result);
        return result;
      },
    },
  },
});

function maskEncToken(val: unknown): void {
  if (Array.isArray(val)) {
    val.forEach(maskEncToken);
  } else if (val !== null && typeof val === "object") {
    const r = val as Record<string, unknown>;
    if ("githubTokenEnc" in r) r.githubTokenEnc = "[redacted]";
  }
}

import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8080),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64).optional(), // 32 bytes hex
  TOKEN_ENCRYPTION_KEY: z.string().length(44).optional(), // 32 bytes base64, legacy

  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),

  GEMINI_API_KEY: z.string().min(1),

  FRONTEND_URL: z.string().url(),
}).superRefine((env, ctx) => {
  if (!env.ENCRYPTION_KEY && !env.TOKEN_ENCRYPTION_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ENCRYPTION_KEY"],
      message: "Required",
    });
  }
});

const _env = EnvSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Invalid environment variables:");
  console.error(_env.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = _env.data;

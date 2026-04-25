// Provide stub values so env.ts validates without real secrets.
// No network connections are made — redis uses lazyConnect, Prisma connects lazily.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "a".repeat(64);
process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("a".repeat(32)).toString("base64");
process.env.GITHUB_CLIENT_ID = "test_client_id";
process.env.GITHUB_CLIENT_SECRET = "test_client_secret";
process.env.GITHUB_CALLBACK_URL = "http://localhost:8080/api/auth/github/callback";
process.env.GEMINI_API_KEY = "test_gemini_key";
process.env.FRONTEND_URL = "http://localhost:5173";

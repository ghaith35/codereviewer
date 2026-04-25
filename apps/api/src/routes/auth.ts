import { Router, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import { env } from "../env.js";
import { encryptToken } from "../lib/crypto.js";
import { signToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { MeResponse } from "@cr/shared";

const router = Router();

const COOKIE_NAME = "cr_session";
const STATE_COOKIE = "cr_oauth_state";
const IS_PROD = env.NODE_ENV === "production";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
  path: "/",
};

// GET /api/auth/github
router.get("/github", (_req: Request, res: Response) => {
  const state = randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, { ...COOKIE_OPTS, maxAge: 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_CALLBACK_URL,
    scope: "read:user repo",
    state,
    allow_signup: "true",
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/auth/github/callback
router.get("/github/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string };
  const storedState = req.cookies?.[STATE_COOKIE];

  if (!state || !storedState || state !== storedState) {
    res.status(400).json({ error: "invalid_state", message: "OAuth state mismatch (CSRF check failed)" });
    return;
  }

  res.clearCookie(STATE_COOKIE, COOKIE_OPTS);

  if (!code) {
    res.status(400).json({ error: "oauth_error", message: "No code returned by GitHub" });
    return;
  }

  let accessToken: string;
  let scopes: string;

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        state,
      }),
    });

    if (!tokenRes.ok) {
      res.status(502).json({ error: "github_unreachable", message: "GitHub token exchange failed" });
      return;
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      res.status(400).json({ error: "oauth_error", message: tokenData.error ?? "Token exchange failed" });
      return;
    }

    accessToken = tokenData.access_token;
    scopes = tokenData.scope ?? "";
  } catch {
    res.status(502).json({ error: "github_unreachable", message: "Could not reach GitHub" });
    return;
  }

  // Fetch GitHub user profile
  let ghUser: { id: number; login: string; email: string | null; name: string | null; avatar_url: string };
  try {
    const profileRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    ghUser = (await profileRes.json()) as typeof ghUser;
  } catch {
    res.status(502).json({ error: "github_unreachable", message: "Could not fetch GitHub profile" });
    return;
  }

  const { enc, iv, tag } = encryptToken(accessToken);

  const user = await prisma.user.upsert({
    where: { githubId: ghUser.id },
    create: {
      githubId: ghUser.id,
      githubLogin: ghUser.login,
      email: ghUser.email,
      name: ghUser.name,
      avatarUrl: ghUser.avatar_url,
      githubTokenEnc: enc,
      githubTokenIv: iv,
      githubTokenTag: tag,
      githubScopes: scopes,
      lastLoginAt: new Date(),
    },
    update: {
      githubLogin: ghUser.login,
      email: ghUser.email,
      name: ghUser.name,
      avatarUrl: ghUser.avatar_url,
      githubTokenEnc: enc,
      githubTokenIv: iv,
      githubTokenTag: tag,
      githubScopes: scopes,
      lastLoginAt: new Date(),
    },
  });

  const jwt = signToken({ sub: user.id, gh: user.githubId });
  res.cookie(COOKIE_NAME, jwt, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.redirect(`${env.FRONTEND_URL}/dashboard`);
});

// POST /api/auth/logout
router.post("/logout", requireAuth, (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
  res.status(204).send();
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: {
      id: true,
      githubLogin: true,
      email: true,
      name: true,
      avatarUrl: true,
      plan: true,
      analysesUsedMtd: true,
    },
  });

  const body: MeResponse = {
    id: user.id,
    githubLogin: user.githubLogin,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    plan: user.plan,
    analysesUsedMtd: user.analysesUsedMtd,
    analysesQuota: user.plan === "FREE" ? 3 : -1,
  };

  res.json(body);
});

export default router;

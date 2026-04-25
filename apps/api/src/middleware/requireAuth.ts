import type { Request, Response, NextFunction } from "express";
import { verifyToken, signToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../env.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; plan: "FREE" | "PRO" };
    }
  }
}

const COOKIE_NAME = "cr_session";
const IS_PROD = env.NODE_ENV === "production";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.cr_session;
  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Not logged in" });
    return;
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, plan: true },
    });
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "User not found" });
      return;
    }
    req.user = { id: user.id, plan: user.plan };

    // Sliding refresh: re-issue cookie if it expires within 24 h
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp - now < 86_400) {
      const fresh = signToken({ sub: payload.sub, gh: payload.gh });
      res.cookie(COOKIE_NAME, fresh, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: IS_PROD ? "none" : "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    next();
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired session" });
  }
}

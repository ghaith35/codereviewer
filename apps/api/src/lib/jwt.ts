import jwt from "jsonwebtoken";
import { env } from "../env.js";

const SECRET = env.JWT_SECRET;
const EXPIRY = "7d";

export interface JwtPayload {
  sub: string;   // user.id
  gh: number;    // user.githubId
  iat?: number;
  exp?: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

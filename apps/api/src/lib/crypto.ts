import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../env.js";

const KEY = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "base64");
const ALGO = "aes-256-gcm";

export function encryptToken(plaintext: string): {
  enc: string;
  iv: string;
  tag: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decryptToken(enc: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

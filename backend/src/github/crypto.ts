import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { githubConfig } from "./config.js";

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

export function encryptToken(plain: string): string {
  const { encKey } = githubConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [b64u(iv), b64u(tag), b64u(data)].join(".");
}

export function decryptToken(payload: string): string {
  const { encKey } = githubConfig();
  const [iv, tag, data] = payload.split(".").map(fromB64u);
  const decipher = createDecipheriv("aes-256-gcm", encKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function hmac(input: string): string {
  return b64u(createHmac("sha256", githubConfig().stateSecret).update(input).digest());
}

export function signState(ttlMs = 10 * 60 * 1000): string {
  const payload = b64u(Buffer.from(JSON.stringify({ nonce: b64u(randomBytes(8)), exp: Date.now() + ttlMs })));
  return `${payload}.${hmac(payload)}`;
}

export function verifyState(state: string): boolean {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return false;
  const expected = hmac(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const { exp } = JSON.parse(fromB64u(payload).toString("utf8"));
    return typeof exp === "number" && Date.now() < exp;
  } catch { return false; }
}

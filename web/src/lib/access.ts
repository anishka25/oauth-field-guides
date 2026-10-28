// Access gate for the live agent (sandbox + model usage). The cookie value is
// `<expiry>.<hmac>` signed with SESSION_SECRET; Web Crypto so it runs in the
// proxy and in route handlers alike.

export const COOKIE = "ofg_access";
export const MAX_AGE_S = 7 * 24 * 3600;

const enc = new TextEncoder();

async function hmac(data: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function makeToken() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE_S);
  return `${exp}.${await hmac(exp)}`;
}

export async function verifyToken(token: string | undefined) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  try {
    return safeEqual(sig, await hmac(exp));
  } catch {
    return false;
  }
}

/** Compares a submitted code with ACCESS_CODE via their HMACs (constant length). */
export async function checkCode(code: string) {
  const expected = process.env.ACCESS_CODE;
  if (!expected) return false;
  return safeEqual(await hmac(`code:${code}`), await hmac(`code:${expected}`));
}

/** For route handlers: true when the request carries a valid access cookie. */
export async function hasAccess(req: Request) {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return verifyToken(m?.[1]);
}

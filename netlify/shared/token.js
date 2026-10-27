// Gedeelde helpers voor de toegangscontrole (cursistenportaal + e-learning).
// De toegangscode staat als omgevingsvariabele COLLEO_ACCESS_CODE in Netlify,
// nooit in deze code. Een andere code instellen = iedereen opnieuw laten inloggen.

export const COOKIE = "colleo_access";
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 dagen

const enc = new TextEncoder();

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Vergelijking in constante tijd (via HMAC van beide kanten).
export async function safeEqual(a, b) {
  const k = "colleo-compare";
  const [x, y] = await Promise.all([hmac(k, String(a)), hmac(k, String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function makeToken(secret, now = Date.now()) {
  const exp = String(now + MAX_AGE * 1000);
  return exp + "." + (await hmac(secret, exp));
}

export async function isValidToken(token, secret, now = Date.now()) {
  if (!token || !secret) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

export function readCookie(request, name = COOKIE) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// Enkel interne paden toelaten als doorverwijzing na het inloggen.
export function safeNext(next) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/portaal.html";
  }
  return next;
}

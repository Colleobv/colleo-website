// POST /api/login  { code }  → zet een toegangscookie als de code klopt
// POST /api/logout            → wist de cookie
import { COOKIE, MAX_AGE, makeToken, safeEqual, safeNext } from "../shared/token.js";

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });

export default async (request) => {
  const url = new URL(request.url);
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);

  if (url.pathname === "/api/logout") {
    return json({ ok: true }, 200, {
      "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    });
  }

  const secret = Netlify.env.get("COLLEO_ACCESS_CODE");
  if (!secret) return json({ ok: false, error: "not_configured" }, 503);

  let body = {};
  try { body = await request.json(); } catch (_) { /* leeg */ }
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!code || !(await safeEqual(code, secret))) {
    await new Promise((r) => setTimeout(r, 600)); // gokken afremmen
    return json({ ok: false, error: "invalid" }, 401);
  }

  const token = await makeToken(secret);
  return json({ ok: true, next: safeNext(body.next) }, 200, {
    "set-cookie": `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
  });
};

export const config = { path: ["/api/login", "/api/logout"] };

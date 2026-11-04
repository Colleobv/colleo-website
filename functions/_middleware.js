// ---- Colleo wachtwoordscherm (gedeelde logica) ----
// SITE_PASSWORD      = wachtwoord voor de hele site (team).
// ELEARNING_PASSWORD = apart wachtwoord voor deelnemers: geeft enkel toegang tot de e-learning(s) in ELEARNING.
// Wie het sitewachtwoord heeft, kan ook de e-learning openen.

const COOKIE = "colleo_gate";
const ELEARN_COOKIE = "colleo_elearn";
const ELEARNING = [/^\/elearning-pijn(\.html)?\/?$/];
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dagen ingelogd blijven
const PUBLIC = [
  /^\/img\//,
  /^\/vendor\//,
  /^\/robots\.txt$/,
  /^\/favicon\./,
];

async function token(password, salt = "colleo-gate-v1") {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(salt));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function safeNext(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const TEXT = {
  site: { title: "Colleo — Binnenkort online", h1: "Binnenkort online", intro: "Onze website wordt nog afgewerkt. Heb je een toegangswachtwoord gekregen? Log dan hieronder in." },
  elearning: { title: "Colleo — E-learning Complexe pijn", h1: "E-learning Complexe pijn", intro: "Log in met het wachtwoord dat je van Colleo kreeg om de e-learning te starten." },
};

function loginPage(next, message, status, realm = "site") {
  const t = TEXT[realm];
  const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${t.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Hanken+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --navy:#1e2d4a; --accent:#3ecfb2; --accent-ink:#0f5e50; --bg:#f7f3ec; --surface:#fff; --ink:#1b2436; --muted:#5b6577; --hairline:rgba(30,45,74,.12); --danger:#b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg:#131b2b; --surface:#1c2639; --ink:#eef1f6; --muted:#a3adbf; --hairline:rgba(255,255,255,.12); --accent-ink:#3ecfb2; --danger:#ff8a80; } }
  * { box-sizing:border-box; margin:0; }
  body { min-height:100vh; display:grid; place-items:center; padding:24px 16px; background:var(--bg); color:var(--ink); font-family:"Hanken Grotesk",system-ui,sans-serif; }
  .card { width:100%; max-width:400px; background:var(--surface); border:1px solid var(--hairline); border-radius:22px; padding:40px 32px 32px; box-shadow:0 30px 70px -30px rgba(27,36,54,.4); }
  .brand { font-family:"Bricolage Grotesque",Georgia,serif; font-weight:700; font-size:28px; letter-spacing:-.02em; display:flex; align-items:center; gap:10px; }
  .dot { width:12px; height:12px; border-radius:50%; background:var(--accent); }
  h1 { font-family:"Bricolage Grotesque",Georgia,serif; font-weight:600; font-size:22px; margin:28px 0 8px; }
  p { color:var(--muted); line-height:1.55; font-size:15px; }
  label { display:block; font-weight:600; font-size:14px; margin:24px 0 8px; }
  input { width:100%; font:inherit; font-size:16px; padding:13px 14px; border-radius:12px; border:1px solid var(--hairline); background:transparent; color:var(--ink); }
  input:focus { outline:2px solid var(--accent); outline-offset:1px; border-color:transparent; }
  button { width:100%; margin-top:16px; font:inherit; font-weight:600; font-size:16px; padding:13px; border:0; border-radius:999px; background:var(--navy); color:#fff; cursor:pointer; }
  @media (prefers-color-scheme: dark) { button { background:var(--accent); color:#0b1a17; } }
  button:hover { filter:brightness(1.1); }
  .err { margin-top:16px; color:var(--danger); font-size:14px; font-weight:500; }
  .foot { margin-top:24px; font-size:13px; }
  .foot a { color:var(--accent-ink); }
</style>
</head>
<body>
  <main class="card">
    <div class="brand"><span class="dot"></span>Colleo</div>
    <h1>${t.h1}</h1>
    <p>${t.intro}</p>
    <form method="post" action="/__login">
      <input type="hidden" name="next" value="${esc(next)}">
      <input type="hidden" name="realm" value="${realm}">
      <label for="pw">Wachtwoord</label>
      <input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
      <button type="submit">Inloggen</button>
      ${message ? `<p class="err" role="alert">${esc(message)}</p>` : ""}
    </form>
    <p class="foot">Vragen? Mail ons op <a href="mailto:info@colleo.be">info@colleo.be</a>.</p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: status || 401,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

function setCookie(name, value) {
  return `${name}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

async function gate(request, password, elearnPassword, next) {
  const url = new URL(request.url);
  const path = url.pathname;
  const withNoindex = async () => {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
    return out;
  };

  if (PUBLIC.some((re) => re.test(path))) return next();

  if (path === "/__logout") {
    const h = new Headers({ Location: "/" });
    h.append("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    h.append("Set-Cookie", `${ELEARN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return new Response(null, { status: 302, headers: h });
  }

  const siteToken = password ? await token(password) : null;
  const elearnToken = elearnPassword ? await token(elearnPassword, "colleo-elearn-v1") : null;
  const hasSite = siteToken && readCookie(request, COOKIE) === siteToken;
  const hasElearn = elearnToken && readCookie(request, ELEARN_COOKIE) === elearnToken;

  if (path === "/__login" && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const given = form ? String(form.get("password") || "") : "";
    const realm = form && form.get("realm") === "elearning" ? "elearning" : "site";
    const dest = safeNext(form ? form.get("next") : "/");
    if (given) {
      // Sitewachtwoord werkt op beide schermen; e-learningwachtwoord enkel voor de e-learning.
      if (siteToken && (await token(given)) === siteToken) {
        return new Response(null, { status: 303, headers: { Location: dest, "Set-Cookie": setCookie(COOKIE, siteToken) } });
      }
      if (realm === "elearning" && elearnToken && (await token(given, "colleo-elearn-v1")) === elearnToken) {
        return new Response(null, { status: 303, headers: { Location: dest, "Set-Cookie": setCookie(ELEARN_COOKIE, elearnToken) } });
      }
    }
    return loginPage(dest, "Dat wachtwoord klopt niet. Probeer het opnieuw.", 401, realm);
  }

  if (ELEARNING.some((re) => re.test(path))) {
    if (!elearnPassword) return withNoindex(); // nog geen e-learningwachtwoord ingesteld: pagina blijft open zoals voorheen
    if (hasSite || hasElearn) return withNoindex();
    return loginPage(path + url.search, "", 401, "elearning");
  }

  if (!password) return loginPage("/", "Er is nog geen wachtwoord ingesteld voor deze website.", 503);
  if (hasSite) return withNoindex();
  return loginPage(path + url.search);
}

// ---- Cloudflare Pages ----
export async function onRequest(context) {
  return gate(context.request, context.env.SITE_PASSWORD, context.env.ELEARNING_PASSWORD, () => context.next());
}

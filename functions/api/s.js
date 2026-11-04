// POST /api/s — ontvangt meetpunten van /s.js. Geen cookies, geen IP-adres opgeslagen.
// Unieke bezoekers: een hash van (geheime dagsleutel + IP + browser) die elke dag verandert,
// zodat iemand niet over dagen heen gevolgd kan worden en het IP nooit bewaard wordt.
import { db, json } from "./_stats-db.js";

const BOTS = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|pingdom|uptime|curl|wget|python|axios|node-fetch|facebookexternalhit|whatsapp|telegram|discord|embedly|quora|skype/i;
const KEEP_DAYS = 760; // ± 25 maanden

const cut = (v, n) => (v == null ? null : String(v).slice(0, n));
const int = (v, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};

async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function browserOf(ua) {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Andere";
}

function deviceOf(w, ua) {
  if (/iPad|Tablet/.test(ua)) return "Tablet";
  if (w && w < 700) return "Mobiel";
  if (w && w < 1100) return "Tablet";
  return "Desktop";
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && new URL(origin).host !== url.host) return new Response(null, { status: 403 });

  const ua = request.headers.get("User-Agent") || "";
  if (!ua || BOTS.test(ua)) return new Response(null, { status: 204 });

  const d = await db(env);
  if (!d) return new Response(null, { status: 204 }); // database nog niet gekoppeld: stil negeren

  let b;
  try {
    b = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!b || typeof b !== "object") return new Response(null, { status: 400 });

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const secret = env.STATS_SALT || env.STATS_PASSWORD || "colleo";
  const visitor = await sha(`${secret}|${day}|${ip}|${ua}|${url.host}`);

  if (b.t === "pv") {
    const id = cut(b.id, 40);
    const path = cut(b.p, 200);
    if (!id || !path || !path.startsWith("/")) return new Response(null, { status: 400 });
    let ref = null;
    try {
      if (b.r) {
        const h = new URL(b.r).host.replace(/^www\./, "");
        if (h && h !== url.host.replace(/^www\./, "")) ref = h.slice(0, 120);
      }
    } catch {}
    const scr = b.s && typeof b.s === "object" ? b.s : null;
    await d
      .prepare(
        `INSERT OR IGNORE INTO pv (id, ts, day, path, title, scr_i, scr_n, scr_title, scr_type, visitor, entry, ref, src, country, device, browser)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
      )
      .bind(
        id, now, day, path, cut(b.ti, 160),
        scr ? int(scr.i, 999) : null, scr ? int(scr.n, 999) : null, scr ? cut(scr.title, 160) : null, scr ? cut(scr.type, 20) : null,
        visitor, b.e ? 1 : 0, ref, cut(b.src, 60), cut(request.cf && request.cf.country, 2),
        deviceOf(int(b.w, 10000), ua), browserOf(ua)
      )
      .run();
    if (Math.random() < 0.01) {
      const old = now - KEEP_DAYS * 864e5;
      await d.batch([d.prepare("DELETE FROM pv WHERE ts < ?1").bind(old), d.prepare("DELETE FROM ev WHERE ts < ?1").bind(old)]);
    }
  } else if (b.t === "eng") {
    // tijd op de pagina wordt in stukjes doorgestuurd (telkens als het tabblad verborgen wordt)
    const id = cut(b.id, 40);
    if (!id) return new Response(null, { status: 400 });
    await d
      .prepare("UPDATE pv SET dur = MIN(dur + ?1, 14400000), scroll = MAX(scroll, ?2) WHERE id = ?3")
      .bind(int(b.d, 1800000), int(b.sc, 100), id)
      .run();
  } else if (b.t === "ev") {
    const name = cut(b.n, 40);
    const path = cut(b.p, 200);
    if (!name || !path) return new Response(null, { status: 400 });
    await d
      .prepare("INSERT INTO ev (ts, day, path, name, label, value, visitor) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(now, day, path, name, cut(b.l, 160), b.v == null ? null : int(b.v, 1e9), visitor)
      .run();
  } else {
    return new Response(null, { status: 400 });
  }
  return new Response(null, { status: 204 });
}

export function onRequestGet() {
  return json({ ok: true });
}

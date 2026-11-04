// GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD — cijfers voor /statistieken.
// Beveiligd met het wachtwoord in STATS_PASSWORD (header "Authorization: Bearer <wachtwoord>").
import { db, json } from "./_stats-db.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const ax = new Uint8Array(x), by = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ax.length; i++) diff |= ax[i] ^ by[i];
  return diff === 0;
}

const shift = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;

export async function onRequestGet({ request, env }) {
  if (!env.STATS_PASSWORD) return json({ error: "no_password", message: "Er is nog geen STATS_PASSWORD ingesteld." }, 503);
  const auth = request.headers.get("Authorization") || "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!given || !(await same(given, env.STATS_PASSWORD))) return json({ error: "auth" }, 401);

  const d = await db(env);
  if (!d) return json({ error: "no_db", message: "De database STATS_DB is nog niet gekoppeld." }, 503);

  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  let to = url.searchParams.get("to");
  let from = url.searchParams.get("from");
  if (!DAY.test(to || "")) to = today;
  if (!DAY.test(from || "")) from = shift(to, -29);
  if (from > to) [from, to] = [to, from];
  const len = daysBetween(from, to);
  const pFrom = shift(from, -len), pTo = shift(from, -1);

  const q = (sql, ...args) => d.prepare(sql).bind(...args);
  const R = "day BETWEEN ?1 AND ?2";

  const res = await d.batch([
    // 0 totalen
    q(`SELECT COUNT(*) pv, COALESCE(SUM(dur),0) dur, SUM(CASE WHEN dur>0 THEN 1 ELSE 0 END) withdur FROM pv WHERE ${R}`, from, to),
    // 1 unieke bezoekers per dag (bezoekers-id wisselt dagelijks)
    q(`SELECT day, COUNT(*) pv, COUNT(DISTINCT visitor) uv FROM pv WHERE ${R} GROUP BY day ORDER BY day`, from, to),
    // 2 pagina's
    q(`SELECT path, MAX(title) title, COUNT(*) pv, COUNT(DISTINCT day||visitor) uv, SUM(dur) dur,
         SUM(CASE WHEN dur>0 THEN 1 ELSE 0 END) withdur, ROUND(AVG(CASE WHEN scr_i IS NULL THEN scroll END)) scroll,
         SUM(entry) entries
       FROM pv WHERE ${R} GROUP BY path ORDER BY uv DESC, pv DESC LIMIT 60`, from, to),
    // 3 herkomst (websites)
    q(`SELECT ref k, COUNT(DISTINCT day||visitor) n FROM pv WHERE ${R} AND entry=1 AND ref IS NOT NULL GROUP BY ref ORDER BY n DESC LIMIT 15`, from, to),
    // 4 campagnebron (?utm_source= of ?ref=)
    q(`SELECT src k, COUNT(DISTINCT day||visitor) n FROM pv WHERE ${R} AND src IS NOT NULL GROUP BY src ORDER BY n DESC LIMIT 15`, from, to),
    // 5 landen
    q(`SELECT COALESCE(country,'?') k, COUNT(DISTINCT day||visitor) n FROM pv WHERE ${R} GROUP BY k ORDER BY n DESC LIMIT 10`, from, to),
    // 6 toestellen
    q(`SELECT device k, COUNT(DISTINCT day||visitor) n FROM pv WHERE ${R} GROUP BY device ORDER BY n DESC`, from, to),
    // 7 browsers
    q(`SELECT browser k, COUNT(DISTINCT day||visitor) n FROM pv WHERE ${R} GROUP BY browser ORDER BY n DESC`, from, to),
    // 8 e-learningschermen
    q(`SELECT path, scr_i i, MAX(scr_n) n, MAX(scr_title) title, MAX(scr_type) type, COUNT(*) pv,
         COUNT(DISTINCT day||visitor) uv, SUM(dur) dur, SUM(CASE WHEN dur>0 THEN 1 ELSE 0 END) withdur
       FROM pv WHERE ${R} AND scr_i IS NOT NULL GROUP BY path, scr_i ORDER BY path, scr_i`, from, to),
    // 9 gebeurtenissen
    q(`SELECT path, name, label, COUNT(*) n, COUNT(DISTINCT day||visitor) uv, ROUND(AVG(value)) avg
       FROM ev WHERE ${R} GROUP BY path, name, label ORDER BY path, name, n DESC`, from, to),
    // 10 vorige periode (ter vergelijking)
    q(`SELECT COUNT(*) pv, COALESCE(SUM(dur),0) dur, SUM(CASE WHEN dur>0 THEN 1 ELSE 0 END) withdur FROM pv WHERE ${R}`, pFrom, pTo),
    q(`SELECT COUNT(*) uv FROM (SELECT DISTINCT day, visitor FROM pv WHERE ${R})`, pFrom, pTo),
    q(`SELECT COUNT(*) uv FROM (SELECT DISTINCT day, visitor FROM pv WHERE ${R})`, from, to),
    // 13 nu actief (laatste 5 min)
    q(`SELECT COUNT(DISTINCT visitor) n FROM pv WHERE ts > ?1`, Date.now() - 5 * 60e3),
    // 14 bezoeken per uur van de dag (Belgische tijd is ongeveer UTC+1/+2; we geven UTC-tijdstempels terug)
    q(`SELECT ts FROM pv WHERE ${R} AND (scr_i IS NULL OR scr_i = 0) LIMIT 20000`, from, to),
  ]);

  const rows = (i) => res[i].results || [];
  const t = rows(0)[0] || {}, pt = rows(10)[0] || {};
  return json({
    range: { from, to, days: len, prevFrom: pFrom, prevTo: pTo },
    totals: { pv: t.pv || 0, uv: rows(12)[0]?.uv || 0, dur: t.dur || 0, withdur: t.withdur || 0 },
    prev: { pv: pt.pv || 0, uv: rows(11)[0]?.uv || 0, dur: pt.dur || 0, withdur: pt.withdur || 0 },
    live: rows(13)[0]?.n || 0,
    daily: rows(1),
    pages: rows(2),
    refs: rows(3),
    sources: rows(4),
    countries: rows(5),
    devices: rows(6),
    browsers: rows(7),
    screens: rows(8),
    events: rows(9),
    hours: rows(14).map((r) => r.ts),
  });
}

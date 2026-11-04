// Gedeelde database-logica voor de cookievrije statistieken (Cloudflare D1, binding "STATS_DB").
// Tabellen worden automatisch aangemaakt bij het eerste gebruik.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS pv (
    id TEXT PRIMARY KEY,
    ts INTEGER NOT NULL,
    day TEXT NOT NULL,
    path TEXT NOT NULL,
    title TEXT,
    scr_i INTEGER,
    scr_n INTEGER,
    scr_title TEXT,
    scr_type TEXT,
    visitor TEXT NOT NULL,
    entry INTEGER DEFAULT 0,
    ref TEXT,
    src TEXT,
    country TEXT,
    device TEXT,
    browser TEXT,
    dur INTEGER DEFAULT 0,
    scroll INTEGER DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS pv_day ON pv(day)`,
  `CREATE INDEX IF NOT EXISTS pv_path ON pv(path, day)`,
  `CREATE INDEX IF NOT EXISTS pv_ts ON pv(ts)`,
  `CREATE TABLE IF NOT EXISTS ev (
    ts INTEGER NOT NULL,
    day TEXT NOT NULL,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    label TEXT,
    value INTEGER,
    visitor TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS ev_day ON ev(day, name)`,
];

let ready = false;
export async function db(env) {
  const d = env.STATS_DB;
  if (!d) return null;
  if (!ready) {
    await d.batch(SCHEMA.map((s) => d.prepare(s)));
    ready = true;
  }
  return d;
}

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...extra },
  });
}

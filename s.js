/* Colleo — cookievrije bezoekersstatistieken.
   Geen cookies, geen localStorage voor bezoekers, geen externe diensten.
   Meet: paginaweergaven, tijd op de pagina, scrolldiepte, herkomst en (in e-learnings) elk scherm.
   Eigen gebeurtenissen: window.colleoTrack('naam', 'label', getal) */
(function () {
  'use strict';
  var d = document, w = window, nav = navigator;
  if (w.__colleoStats) return; w.__colleoStats = true;
  try { if (localStorage.getItem('colleo_stats_ignore') === '1') { w.colleoTrack = function () {}; return; } } catch (e) {}
  if (nav.webdriver || /^(localhost|127\.|\[::1\])/.test(location.hostname) || location.protocol === 'file:') { w.colleoTrack = function () {}; return; }

  var END = '/api/s';
  function send(o) {
    var body = JSON.stringify(o);
    try {
      if (nav.sendBeacon && nav.sendBeacon(END, new Blob([body], { type: 'text/plain' }))) return;
    } catch (e) {}
    try { fetch(END, { method: 'POST', body: body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }); } catch (e) {}
  }
  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function cleanPath() { var p = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/'); return p.length > 1 ? p.replace(/\/$/, '') : '/'; }

  var qs = new URLSearchParams(location.search);
  var src = qs.get('utm_source') || qs.get('ref') || qs.get('bron') || null;
  var firstRef = d.referrer;
  var isEntry = (function () { try { return !firstRef || new URL(firstRef).host !== location.host; } catch (e) { return true; } })();

  var cur = null; // { id, start, active, total, maxScroll }
  function scrollPct() {
    var h = d.documentElement, b = d.body;
    var max = Math.max(h.scrollHeight, b ? b.scrollHeight : 0) - h.clientHeight;
    return max <= 0 ? 100 : Math.round(Math.min(1, (w.scrollY || h.scrollTop) / max) * 100);
  }
  function flush() {
    if (!cur) return;
    var now = Date.now();
    if (cur.active) { cur.total += now - cur.active; cur.active = d.visibilityState === 'visible' ? now : 0; }
    if (cur.total >= 1000 || cur.maxScroll > cur.sentScroll) {
      send({ t: 'eng', id: cur.id, d: cur.total, sc: cur.maxScroll });
      cur.total = 0; cur.sentScroll = cur.maxScroll;
    }
  }
  function view(screen) {
    flush();
    cur = { id: rid(), active: d.visibilityState === 'visible' ? Date.now() : 0, total: 0, maxScroll: 0, sentScroll: 0 };
    var o = { t: 'pv', id: cur.id, p: cleanPath(), ti: d.title, w: w.innerWidth, e: isEntry ? 1 : 0 };
    if (isEntry) { o.r = firstRef; if (src) o.src = src; }
    if (screen) o.s = screen;
    send(o);
    isEntry = false; // enkel de eerste weergave telt als binnenkomst
    setTimeout(function () { if (cur) cur.maxScroll = Math.max(cur.maxScroll, scrollPct()); }, 400);
  }

  w.addEventListener('scroll', function () { if (cur) { var s = scrollPct(); if (s > cur.maxScroll) cur.maxScroll = s; } }, { passive: true });
  d.addEventListener('visibilitychange', function () {
    if (!cur) return;
    if (d.visibilityState === 'hidden') flush();
    else cur.active = Date.now();
  });
  w.addEventListener('pagehide', flush);
  // vangnet: elke 20 s tussentijds doorsturen, zodat de tijd ook telt als de browser hard wordt afgesloten
  setInterval(function () { if (d.visibilityState === 'visible') flush(); }, 20000);

  w.colleoTrack = function (name, label, value) {
    if (!name) return;
    send({ t: 'ev', p: cleanPath(), n: String(name), l: label == null ? null : String(label), v: value == null ? null : value });
  };

  // E-learnings: elk scherm telt als aparte weergave (zo zie je tijd per scherm en waar mensen afhaken).
  function scr(det) { return det ? { i: det.i, n: det.n, title: det.title, type: det.type } : null; }
  w.addEventListener('colleo:scherm', function (e) { view(scr(e.detail)); });
  if (w.__colleoScherm) view(scr(w.__colleoScherm));
  else if (!w.MODULE) view(null);
})();

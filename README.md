# colleo-website

Website van Colleo BV (colleo.be). Elke push naar `main` wordt automatisch gepubliceerd via Cloudflare Pages (project "colleo").

## Wachtwoordscherm (tijdelijk)

De site staat achter een wachtwoord zolang ze nog niet af is. Het wachtwoord staat in de omgevingsvariabele `SITE_PASSWORD` bij de host (Cloudflare Pages: Settings → Variables and Secrets; Netlify: Site configuration → Environment variables). Na een wijziging opnieuw deployen.

- E-learning Complexe pijn (`/elearning-pijn`) heeft een apart wachtwoord voor deelnemers: `ELEARNING_PASSWORD`. Daarmee kom je enkel op de e-learning, niet op de rest van de site. Het sitewachtwoord werkt ook op de e-learning. Zolang `ELEARNING_PASSWORD` niet is ingesteld, blijft de e-learning open.
- Altijd vrij: `/img/*`, `/vendor/*` (zie `PUBLIC` in de code).
- Uitloggen: `/__logout`.
- Code: `functions/_middleware.js` (Cloudflare) en `netlify/edge-functions/gate.js` (Netlify) — hou beide gelijk.
- Weghalen bij lancering: verwijder beide bestanden, `_routes.json` en het `[[edge_functions]]`-blok in `netlify.toml`.

## Statistieken (cookievrij)

Eigen bezoekersstatistieken, zonder cookies of externe diensten. Dashboard: **colleo.be/statistieken** (eigen wachtwoord, los van het wachtwoordscherm).

- `s.js` — meetscript, staat onderaan elke pagina. Meet paginaweergaven, actieve tijd, scrolldiepte, herkomst en in de e-learnings elk scherm apart (+ toetsresultaat, gestarte video's, feedback).
- `functions/api/s.js` — slaat de metingen op. Geen IP-adressen; unieke bezoekers via een hash die elke dag verandert. Bots worden gefilterd. Data ouder dan ± 25 maanden wordt automatisch gewist.
- `functions/api/stats.js` + `statistieken.html` — het dashboard.

**Eenmalig instellen in Cloudflare:**
1. Storage & databases → D1 → Create database `colleo-stats`.
2. Workers & Pages → colleo → Settings → Bindings → Add → D1 database: variabele `STATS_DB` → `colleo-stats`.
3. Settings → Variables and Secrets → `STATS_PASSWORD` (Secret) = wachtwoord voor het dashboard.
4. Opnieuw deployen. De tabellen worden automatisch aangemaakt.

Tips:
- Campagnes meten: voeg `?bron=…` toe aan links, bv. `colleo.be?bron=nieuwsbrief` of `?bron=qr` op de QR-code.
- Eigen bezoeken uitsluiten: vink onderaan het dashboard "Mijn bezoeken niet meetellen" aan (per toestel/browser).
- Eigen gebeurtenis meten vanuit een pagina: `colleoTrack('naam', 'label', getal)`.

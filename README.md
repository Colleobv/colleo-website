# colleo-website

Website van Colleo BV (colleo.be). Elke push naar `main` wordt automatisch gepubliceerd via Netlify.

## Wachtwoordscherm (tijdelijk)

De site staat achter een wachtwoord zolang ze nog niet af is. Het wachtwoord staat in de omgevingsvariabele `SITE_PASSWORD` bij de host (Cloudflare Pages: Settings → Variables and Secrets; Netlify: Site configuration → Environment variables). Na een wijziging opnieuw deployen.

- Vrij toegankelijk blijven: `/elearning-pijn`, `/img/*`, `/vendor/*` (zie `PUBLIC` in de code).
- Uitloggen: `/__logout`.
- Code: `functions/_middleware.js` (Cloudflare) en `netlify/edge-functions/gate.js` (Netlify) — hou beide gelijk.
- Weghalen bij lancering: verwijder beide bestanden, `_routes.json` en het `[[edge_functions]]`-blok in `netlify.toml`.

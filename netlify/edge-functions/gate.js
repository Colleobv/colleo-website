// Schermt het cursistenportaal en de e-learning af.
// Zonder geldige toegangscookie word je naar de loginpagina gestuurd.
import { readCookie, isValidToken } from "../shared/token.js";

export default async (request, context) => {
  const secret = Netlify.env.get("COLLEO_ACCESS_CODE");
  if (await isValidToken(readCookie(request), secret)) {
    const res = await context.next();
    res.headers.set("cache-control", "private, no-store");
    res.headers.set("x-robots-tag", "noindex");
    return res;
  }
  const url = new URL(request.url);
  const login = new URL("/login.html", url);
  login.searchParams.set("next", url.pathname + url.search);
  return new Response(null, {
    status: 302,
    headers: { location: login.pathname + login.search, "cache-control": "no-store" },
  });
};

export const config = {
  path: [
    "/portaal", "/portaal.html",
    "/les", "/les.html",
    "/elearning", "/elearning.html",
  ],
};

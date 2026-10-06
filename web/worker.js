// Cloudflare Worker: serves the PWA and proxies /api/* to the Render API.
// Keeps one origin for the app (no CORS), hides the Render URL, and adds security headers.

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

function secure(res, isApi = false) {
  const r = new Response(res.body, res);
  r.headers.set('x-content-type-options', 'nosniff');
  r.headers.set('referrer-policy', 'no-referrer');
  r.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  if (!isApi) {
    r.headers.set('content-security-policy', CSP);
    r.headers.set('permissions-policy', 'microphone=(self), camera=(), geolocation=()');
  } else {
    r.headers.set('cache-control', r.headers.get('cache-control') || 'no-store');
  }
  return r;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN);
      const headers = new Headers(request.headers);
      headers.set('x-proxy-secret', env.PROXY_SECRET || '');
      headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || '');
      headers.delete('cookie');
      const res = await fetch(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, redirect: 'manual' });
      return secure(res, true);
    }
    return secure(await env.ASSETS.fetch(request));
  },
};

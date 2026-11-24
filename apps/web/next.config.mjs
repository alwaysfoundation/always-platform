/** Always web. Two builds:
 *  - server (default): /api/* is passed to the Always API, so the browser talks to one origin.
 *  - static (STATIC_EXPORT=1): plain files served at my.alwaysfoundation.org, calling the API directly. */
const API_URL = process.env.ALWAYS_API_URL ?? 'http://localhost:8787';
const STATIC = process.env.STATIC_EXPORT === '1';

const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

export default {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(STATIC
    ? { output: 'export', trailingSlash: true, images: { unoptimized: true }, env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'https://api.alwaysfoundation.org' } }
    : {
        async rewrites() { return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }, { source: '/r/:token', destination: '/r' }]; },
        async headers() { return [{ source: '/:path*', headers: security }]; },
      }),
};

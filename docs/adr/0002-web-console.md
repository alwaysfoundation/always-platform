# ADR 0002: Always web talks to the API through its own origin

- Status: proposed
- Date: 2026-11-18

## Context
The church inbox and the foundation console run in the browser and call the Always API, which holds people's details. Cross-origin calls would need CORS on the API and would expose the API address and tokens to more surfaces.

## Decision
`apps/web` (Next.js) passes `/api/*` to the API with a server-side rewrite. The browser sees one origin. The pilot session (a staff token and organisation ID) is kept in `sessionStorage` for the tab only. Passkey sign-in through Supabase Auth replaces it before launch.

## Consequences
- No CORS configuration on the API.
- Web and API can be deployed separately (both in Sydney) without code changes, only `ALWAYS_API_URL`.
- Until passkeys land, pilot tokens must be issued per person and revoked when someone leaves.

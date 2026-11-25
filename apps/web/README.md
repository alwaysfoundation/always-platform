# Always web

The Always app, at my.alwaysfoundation.org: starting an account (`/start`), the Always home (`/home`), the church inbox, reports, the listing, and the foundation console for the care team. Next.js. Once signed in it wears the church's own logo and colours. The marketing site is a separate repo (always-website).

## Run it

```sh
make up && make migrate && make seed   # API database with synthetic data
make dev                               # API on http://localhost:8787
npm run dev -w @always/web             # web on http://localhost:3000
```

The browser only talks to this app. Requests to `/api/*` are passed to the API set in `ALWAYS_API_URL`, so there is one origin and no API address in client code.

## Sign-in

Email and a one-time code, through Supabase Auth. No passwords. The session tokens are kept in the browser and refreshed before they expire; the organisation in use is chosen separately, so one person can belong to several. Invitations land on `/sign-in?invite=…` and are accepted once signed in.

Starting an account (`/start`) asks for the church's name, an optional website (read by the brand import at brand.alwaysfoundation.org for its logo and colours), the look, then an email code and the Nicene Creed affirmation. It creates the organisation with Respond and Safety switched on; Reports is part of every account.

## Demo account

`/demo` opens Hope Church (demo): a made-up church that lives in the browser (`lib/demo.ts`). Every person in it is invented and nothing is sent to Always.

## Builds

- `npm run build`: server build with `/api` proxied to the API.
- `npm run build:static`: static files for my.alwaysfoundation.org, served from `sites/my/` in always-website, calling `https://api.alwaysfoundation.org` directly.

## Principles

- Contact details appear only after a church accepts, as the API enforces.
- Plain, warm words: a church accepts or passes; passing is always OK.
- WCAG 2.2 AA: real buttons and labels, 44 px targets, visible focus.

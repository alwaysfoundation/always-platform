# Always web

Always for churches and ministries (the church inbox) and the foundation console (church claims, events, ideas and problems). Next.js, built with the Always brand kit.

## Run it

```sh
make up && make migrate && make seed   # API database with synthetic data
make dev                               # API on http://localhost:8787
npm run dev -w @always/web             # web on http://localhost:3000
```

The browser only talks to this app. Requests to `/api/*` are passed to the API set in `ALWAYS_API_URL`, so there is one origin and no API address in client code.

## Sign-in

Pilot partners sign in with a staff session token and their organisation ID; the session lives in the tab and ends when it closes. Passkey sign-in through Supabase Auth replaces this before launch (see `ROADMAP.md`).

## Principles

- Contact details appear only after a church accepts, as the API enforces.
- Plain, warm words: a church accepts or passes; passing is always OK.
- WCAG 2.2 AA: real buttons and labels, 44 px targets, visible focus.

# Roadmap

Always is built in the open. This is what we're working on, in order. Each item becomes issues and pull requests in this repository.

## Now: pilots with founding members

- [x] Consent receipt, minors rules and matching (`packages/core`)
- [x] Always API: directory, claims, responses, inbox, accept and pass, activity, profile
- [x] Events and hosted response pages for online responses, with an invisible human check
- [x] Email through Resend; foundation addresses and DNS on Cloudflare
- [x] alwaysfoundation.org live, served from [always-website](https://github.com/alwaysfoundation/always-website)
- [x] Foundation team queue: church claims, suggested events, feedback (`/v1/ops/*`)
- [ ] Hosted API in Sydney (Supabase Postgres, Vercel syd1), with staging
- [ ] Website forms posting to the API in place of email
- [ ] Always for churches and ministries (web): sign in, inbox, page, next steps, team
- [ ] Foundation console: verification queue, events, care team, partners

## Next: the Always Network platform ([RFC 0001](docs/rfc/0001-network-platform.md))

- [ ] Child assent for under 15s and 12-month consent expiry for minors
- [x] Ready to welcome: readiness rules, "welcoming now" badge, readiness in the API
- [x] Church feed (opt-in), verification, Your listing page, "Find a church near me" box
- [ ] Working With Children Check records and youth access that expires with them
- [ ] Developer portal with test keys and synthetic data (keys work; portal page to come)
- [ ] Training for evangelists: sharing your story, leading someone to Jesus, welcoming well, safe ministry with young people
- [x] Always MCP server, version 1: read-only, no personal data; llms.txt
- [ ] Compliance tab: consent register, breach register, retention evidence, child safe checklist
- [ ] One consented journey for adults (`share.journey`), Handoff adapters for Elvanto and Planning Center

## Then: the web apps and the network

Every Always product is a web app for now, with no native mobile app. Each runs in any browser and can be added to a phone's home screen. Each one uses only the public API and SDK, so the apps prove the platform.

- [ ] One Always account: Apple, Google and YouVersion sign-in
- [ ] Always App (web app): Bible reader (YouVersion Platform), conversation guides, response points (Response pages + Handoff), church and event finder (Church feed + Events), prayer list and notes kept in the browser
- [ ] Always for churches (web app): team inbox for introductions (Handoff), church page (Church feed + Verification), leaders' report (Reports)
- [ ] Always for ministries (web app): branded response pages, live results, funder reports, compliance tab
- [ ] Always Agent in pilot with the foundation team, a person deciding every step
- [ ] Interoperability: the Always Handoff standard implemented with partner ministries' tools, so a person's next step can move between systems with their consent

## Later

- [ ] Public results page (totals only, minimum group sizes)
- [ ] Ticketing imports for Christian events
- [ ] Translations of the response card and person pages

Ideas and problems: open an issue, or use [alwaysfoundation.org/#/feedback](https://alwaysfoundation.org/#/feedback).

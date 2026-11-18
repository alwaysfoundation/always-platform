# Roadmap

Always is built in the open. This is what we're working on, in order. Each item becomes issues and pull requests in this repository.

## Now: pilots with founding members

- [x] Consent receipt, minors rules and matching (`packages/core`)
- [x] Always API: directory, claims, responses, inbox, accept and pass, activity, profile
- [x] Events and hosted response pages for online responses, with an invisible human check
- [x] Foundation addresses and DNS on Cloudflare
- [ ] Transactional email through Amazon SES in Sydney (replaces Resend, which has no Australian region)
- [x] alwaysfoundation.org live, served from [always-website](https://github.com/alwaysfoundation/always-website)
- [x] Foundation team queue: church claims, suggested events, feedback (`/v1/ops/*`)
- [ ] Hosted API in Sydney (Supabase Postgres, Vercel syd1), with staging
- [ ] Website forms posting to the API in place of email
- [x] Always for churches and ministries (web): inbox with accept, pass and "we've been in touch"
- [ ] Always for churches and ministries (web): passkey sign-in, page, next steps, team
- [x] Foundation console: church claims, events, ideas and problems
- [ ] Foundation console: verification, care team, partners

## Next: the Always app and the network

- [ ] One Always account: Apple, Google and YouVersion sign-in
- [ ] Always app (Expo): Bible reader, conversation guides, response points, prayer list, field notes transcribed on the phone (NVIDIA Parakeet)
- [ ] Church team inbox in the app
- [ ] Always Agent in pilot with the foundation team, a person deciding every step
- [ ] Interoperability: the Always Handoff standard implemented with partner ministries' tools, so a person's next step can move between systems with their consent

## Later

- [ ] Public results page (totals only, minimum group sizes)
- [ ] Ticketing imports for Christian events
- [ ] Translations of the response card and person pages

Ideas and problems: open an issue, or use [alwaysfoundation.org/#/feedback](https://alwaysfoundation.org/#/feedback).

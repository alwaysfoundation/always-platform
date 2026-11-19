# RFC 0005: Scripture and sign-in with YouVersion Platform

- Status: proposed
- Builds on: RFC 0003, RFC 0004

## Summary

Use YouVersion Platform for Scripture in Always Respond, the Always App and the SDK, and later offer Sign in with YouVersion to adults in the Always App. YouVersion supplies Scripture and, for sign-in, confirms who someone is. Always Platform keeps consent, church membership and everything personal, in Australia.

## What's already built (website repo)

1/ **Scripture service.** `GET /api/scripture/passage?ref=ROM.5.8` on the website Worker calls `https://api.youversion.com/v1/bibles/{id}/passages/{ref}` with the `YVP_APP_KEY` secret, caches the passage, and returns text, reference, translation and copyright. It sends nothing about a person. Without the key it answers `503 not_configured`.

2/ **`<always-scripture>`** at `/sdk/v0/scripture.js`. Its inner text is the fallback.

3/ **Sydney Fire app.** The Romans Road and a John reader use the service and fall back to the ESV text in the page.

## Proposed next

1/ **Move the Scripture service into the Always API** as `GET /v1/scripture/passages/{ref}`, behind the same key, so apps built on the platform don't depend on the website Worker.

2/ **Sign in with YouVersion (adults only).** OAuth 2.0 with PKCE in the Always App. On first sign-in we store only the YouVersion subject id against the Always account. Church membership is recorded only with the person's consent, through the existing consent receipt.

3/ **Reading the Bible as a next step.** Add `bible` to the next-step options only if YouVersion offers reading plans to outside apps; otherwise "Start reading" stays a button, not a routed step.

## Rules

- Nothing personal is ever sent to YouVersion: no response, consent, church, age band or contact details. Only Bible references go out.
- No YouVersion sign-in for anyone under 18. The minors rules run first and are not configurable.
- The app key lives in the environment, never in code.
- YouVersion Platform is for non-commercial ministry use. Commercial apps built on Always need their own arrangement with YouVersion.
- If YouVersion is unavailable, every surface still works: Scripture falls back to text in the page, and sign-in falls back to passkeys.

## Needs

- A YouVersion Platform app registered by the foundation, with its key and redirect URIs.
- Code-owner approval for `auth/` and `consent/` before sign-in is built.

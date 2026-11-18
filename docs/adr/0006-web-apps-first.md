# ADR 0006: Web apps only, built on the public platform

Status: Proposed
Date: 2026-11-18

## Context

The site and roadmap described a native "Always app" (Expo) for evangelists, with the church inbox inside it and voice notes transcribed on the phone. A native app adds app store review, two release tracks and on-device models before we have proven the core journey.

## Decision

1. For now, every Always product is a web app. There is no native mobile app. The apps run in any browser and can be installed to a phone's home screen.
2. There are three products, each a client of Always Platform:
   - **Always App:** Bible (YouVersion Platform), conversation guides, response points (Response pages and Handoff), church and event finder (Church feed and Events), and a prayer list with notes kept in the browser.
   - **Always for churches:** team inbox for introductions (Handoff), church page (Church feed and Verification), and the leaders' report (Reports).
   - **Always for ministries:** branded response pages, live results, funder reports (Reports) and the compliance tab.
3. The web apps use only the public API and SDK. There is no private endpoint, so anything we build, a partner can build.
4. On-device voice transcription is out of scope until a native app is reconsidered.

## Consequences

- One codebase and one release track.
- The apps prove the API and SDK. A gap we hit is a gap partners would hit, and it gets fixed in the platform.
- Prayer lists and notes stay in browser storage on the person's device. Clearing the browser clears them, so the app must say so.
- The consent, minors and Australia-only rules apply unchanged.

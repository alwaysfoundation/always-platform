# RFC 0002: Evangelist API

Status: Draft
Date: 2026-11-18

## Summary

The Evangelist API adds an evangelism layer to Scripture. For each key passage it gives the text, a plain-language explanation and when to share it. For each common objection it gives a short, gentle answer, the passages that speak to it, and conversation tips. It is part of Always Platform: open, free, read-only, and with no personal data.

The first user is the Always App, the web app for evangelists. The same API and SDK are open to any ministry's app.

## Decisions

1. **Always App first.** The viewer is built into the Always App; other apps get the same API and SDK.
2. **Free translations first.** We start with the King James Version, which is public domain in Australia. The World English Bible comes next. YouVersion translations are added once we have a YouVersion Platform key, through their API and on their licence terms. Licensed text is never copied into our repository.
3. **AI drafts, people approve.** AI may draft passages, notes and answers. Nothing is published until an experienced evangelist and a theology reviewer approve it. Every item carries `status` (`draft` or `approved`) and `source`. By default the API returns approved items only; `?drafts=1` includes drafts, clearly marked, for review tools and prototypes. The API never shows a passage under an approved answer unless that passage is approved too.
4. **Open content.** The notes, answers and tips are CC BY 4.0, kept as JSON in `content/evangelist/`, so churches can check, improve and reuse them. Changes go through pull requests, like code.
5. **Tone.** Warm, honest and humble: listen first, never win arguments, point to Jesus. Pronouns for God are capitalised in our own words. Sensitive topics (shame, harm, grief) carry tips that put people's safety first.

## API

| Method | Path | What it returns |
|---|---|---|
| GET | `/v1/evangelist/themes` | Themes (for example `suffering`, `grace`, `resurrection`) with passage counts |
| GET | `/v1/evangelist/passages?theme=&q=` | Passages, filtered by theme or search |
| GET | `/v1/evangelist/passages/{id}` | One passage, plus the objections it helps answer |
| GET | `/v1/evangelist/objections` | Common objections |
| GET | `/v1/evangelist/objections/{id}` | One objection with its answer, tips and passages |

SDK: `always.evangelist.passages()`, `.passage(id)`, `.objections()`, `.objection(id)`, `.themes()`.

## Starter content (all drafts awaiting review)

- 25 key passages (KJV), covering the Gospel, grace, the cross, the resurrection, new life, suffering, creation and verses for evangelists.
- 8 common objections: suffering, other religions, "I'm a good person", science, hypocrisy in the church, the resurrection, "I've done too much", and "later".

## Next

1. A review screen: reviewers approve, edit or reject each item, and their names are recorded.
2. The viewer in the Always App: read a chapter, see highlighted key passages, and tap for the note and related objections.
3. The World English Bible as a second translation.
4. YouVersion Platform integration for more translations, once approved.
5. An MCP tool, so AI assistants can suggest approved passages and answers.

# Always AI (research)

> **Not a product.** Always Foundation decided on 25 November 2026 not to offer Always AI ([ADR 0022](../docs/adr/0022-always-ai-not-a-product.md)). This folder stays as open research that anyone may use and build on.

Faithful AI infrastructure for the Church: free, private, open source, and grounded in the Nicene Creed (AD 381). Built on [Jan](https://github.com/janhq/jan).

Always AI is the faithful AI layer of Always Platform ([ADR 0021](../docs/adr/0021-always-ai-in-the-always-account.md)). It has four parts:

1. **Writing help in the Always account.** Inside Always Respond, Connect, Safety and Reports: drafts in the organisation's voice, translations and Scripture checks. An admin switches on the `ai` module. It runs in the browser or on the person's computer, works only on the organisation's own words (never a person's details, never anything about under-18s), and every result is a draft a person approves.
2. **Agents.** Inside Always Connect and Always Safety: reminders, missing-detail checks and preparing the quarterly check-up, on fixed rules and approved templates, with a person deciding every step.
3. **Building blocks for any Christian app.** Always Scripture (exact Bible text, quote and reference checking, the Nicene Creed and its propositions), an assistant specification, recommended open models and, soon, an open evaluation. Use them in your own app so its AI quotes Scripture accurately and stays within the historic faith.
4. **A study tool for pastors and leaders.** A reference implementation on Jan, with an optional church library pack exported from the Always account: an adult pastor or ministry leader asks questions while preparing a sermon or Bible study, with their own documents searched on their own computer.

**Status: preview (0.1).** The building blocks and the setup pack for Jan are implemented and tested. A branded desktop app is in development. Research and design: [Always AI](https://alwaysfoundation.org/#/always-ai) · [Implementing Always AI on Jan](https://alwaysfoundation.org/#/always-ai-on-jan) · [Christian AI alignment and the Nicene Creed](https://alwaysfoundation.org/#/nicene-alignment) · [Local AI and private sync](https://alwaysfoundation.org/#/private-ai-sync)

## What Always AI is not

Always AI is a tool. Always Foundation does not build, and will not build:

- a conversational AI companion, friend or persona;
- an AI pastor, or anything presented as spiritual authority;
- emotional, mental-health or crisis support;
- anything for people under 18;
- features designed to keep people talking.

When a conversation turns personal, emotional or urgent, the study tool says it cannot help and points the person to someone they trust, their pastor, a professional or emergency services. See [ADR 0018](../docs/adr/0018-always-ai-infrastructure-first.md).

## What is here

| Path | What it is |
| --- | --- |
| `scripture-mcp/` | **Always Scripture**, an offline MCP server: exact Bible text, quote checking, reference checking, search, and the Nicene Creed. No dependencies, no network access. |
| `scripture-mcp/data/` | Seven openly licensed Bibles: English, Spanish, Portuguese, Russian, Chinese, Tagalog and Vietnamese. Licences in `translations.json` and `NOTICE`. |
| `assistant/` | The study tool's instructions for Jan, and the MCP configuration. |
| `creed/` | The Nicene Creed (AD 381), notes on the text, and the propositions answers are checked against. |
| `models/recommended.json` | Default open models, reviewed monthly. |
| `docs/` | The implementation plan (including phones) and the monthly technology review. |

## Use Always Scripture in your app

Any app that speaks the Model Context Protocol can run it:

```json
{ "mcpServers": { "always-scripture": { "command": "node", "args": ["/path/to/ai/scripture-mcp/src/server.js"] } } }
```

Tools: `get_passage`, `verify_quote`, `check_references`, `search_scripture`, `list_translations`, `nicene_creed`. Requires Node 18 or later. An npm package for one-line installs is planned.

## Set up the study tool in Jan (for adults)

1. **Install Jan** from [jan.ai](https://jan.ai) or its [GitHub releases](https://github.com/janhq/jan/releases).
2. **Download a model** in Jan's Hub, by your computer's memory:
   - 8 GB: `unsloth/gemma-4-E2B-it-GGUF` or `unsloth/Qwen3.5-4B-GGUF`
   - 8 to 16 GB: `unsloth/gemma-4-E4B-it-GGUF`
   - 16 GB or more: `google/gemma-4-12B-it-qat-q4_0-gguf`
3. **Download this folder** (the `ai/` folder of the Always Platform repository) and install [Node.js](https://nodejs.org) 18 or later.
4. **Add Always Scripture.** In Jan, open **Settings → MCP Servers**, add a server with command `node` and argument the full path to `scripture-mcp/src/server.js`.
5. **Create the assistant.** Open **Assistants**, create one named *Always AI*, and paste [`assistant/instructions.md`](assistant/instructions.md) into its instructions.
6. **Add your library (optional).** Create a Project and attach your sermons, studies and notes.

Leave cloud providers off unless you choose otherwise. The branded desktop app will make this one step.

## Privacy

- Always Foundation runs no servers for Always AI and receives none of your data.
- Always Scripture makes no network connections.
- Jan stores conversations and documents on your computer. A standard Jan install checks for app updates and downloads models you choose; product analytics are off unless you opt in. Cloud models are used only if you add one.
- Do not add other people's private information, counselling notes, or anything about children.

## Change the boundary

Always AI is open source. A church or denomination can fork it and add its own statement of faith to `assistant/instructions.md` and `creed/`. Please give your fork its own name: "Always" is a trademark of Always Foundation, used only for the Nicene version maintained here.

## Develop

```bash
npm test     # 12 tests: references, passages, quotes, the protocol and stdio
npm start    # run the MCP server on stdio
python3 scripts/build-data.py /path/to/bible_databases <commit>   # rebuild Bible data
```

## Licence

Apache-2.0. Built on Jan by Menlo Research (Apache-2.0); see [NOTICE](NOTICE). Always AI is not affiliated with or endorsed by Menlo Research.

## Releasing

Set `version` in `package.json`, then push a matching tag (`git tag ai-v0.1.0 && git push origin ai-v0.1.0`). The `always-ai-release` workflow tests and publishes to npm. It needs the `NPM_TOKEN` secret.

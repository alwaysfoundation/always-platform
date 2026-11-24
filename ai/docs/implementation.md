# Implementation: Always AI on Jan

Always AI is faithful AI infrastructure first (ADR 0018). The study tool on Jan is a reference implementation for adult pastors and leaders, never a companion or chat product for the public.

Always AI is faithful AI infrastructure first (ADR 0018). The study tool on Jan is a reference implementation for adult pastors and leaders, never a companion or chat product for the public.

How Always AI is built, in the order it ships. Design rationale: [ADR 0015](https://github.com/alwaysfoundation/always-platform/blob/main/docs/adr/0015-always-ai-on-device-nicene-grounded.md), [0016](https://github.com/alwaysfoundation/always-platform/blob/main/docs/adr/0016-private-sync-for-always-ai.md), [0017](https://github.com/alwaysfoundation/always-platform/blob/main/docs/adr/0017-always-ai-built-on-jan.md), [0018](https://github.com/alwaysfoundation/always-platform/blob/main/docs/adr/0018-always-ai-infrastructure-first.md).

## Why Jan

Jan (Apache-2.0, Menlo Research) already provides, on Windows, macOS and Linux:

| Need | Jan provides |
| --- | --- |
| Local models | llama.cpp (and MLX on Apple silicon), GGUF models from Hugging Face |
| The pastor's library | Projects with attached files, local indexing and a `retrieve` tool |
| The Nicene assistant | Assistants with instructions and retrieval settings |
| Scripture and Creed tools | MCP servers, run with Jan's bundled `bun`/`uv`, so users need no Node |
| Cloud models by choice | Providers including OpenRouter and Hugging Face, off until configured |
| No tracking by default | Analytics only initialise if the build includes a PostHog key and the user opts in |

## Stage 1: setup pack for standard Jan (now)

The `ai/` folder of the Always Platform repository. Users install Jan, add Always Scripture, and create the Always AI assistant. See the README.

## Stage 2: Always AI desktop, a fork of Jan

Repository: `alwaysfoundation/always-ai-desktop`, forked from `janhq/jan`, kept close to upstream.

Changes, all small and re-applied on each upstream merge:

| Change | Where in Jan |
| --- | --- |
| Name, identifier, version | `src-tauri/tauri.conf.json` (`productName`, `identifier`), platform `tauri.*.conf.json` files |
| Icons | `src-tauri/icons/` |
| Default assistant becomes Always AI | `extensions/assistant-extension/src/index.ts` (`defaultAssistant`) |
| Always Scripture bundled and on; other default MCP servers off | `src-tauri/src/core/mcp/constants.rs` (`DEFAULT_MCP_CONFIG`); ship the server in app resources so it needs no download |
| Recommended models on first run | `web-app/src/constants/models.ts` and the setup screen |
| Updates from our releases, our signing key | `plugins.updater` in `src-tauri/tauri.conf.json` (endpoints and `pubkey`) |
| No analytics | build without `POSTHOG_KEY` and `POSTHOG_HOST` |
| Attribution | About screen and `NOTICE`: "Built on Jan by Menlo Research" |

Release:

- Builds on GitHub Actions for Windows, macOS and Linux.
- macOS signed and notarised (Apple's developer fee is waived for nonprofits that offer only free apps).
- Windows signed with Azure Artifact Signing; also listed free in the Microsoft Store.
- Updates through Jan's Tauri updater from GitHub Releases. The updater key is held offline by two maintainers; losing it strands installed copies.

Upstream: merge Jan releases monthly (see [model-review.md](model-review.md)), re-run tests and the evaluation, then release.

## Stage 3: phones

Jan's iOS and Android builds currently switch off local inference, the model hub, projects, file attachments and MCP settings (`web-app/src/lib/platform/const.ts`). On phones they can only use cloud providers. That does not meet Always AI's default of private, on-device AI.

Options, in order of preference:

1. **Contribute on-device inference to Jan mobile** (llama.cpp or Google's LiteRT-LM as a Tauri mobile plugin), then enable it in the fork.
2. **Fork an open-source on-device phone app** (PocketPal, MIT; Google AI Edge Gallery, Apache-2.0) and add Always Scripture and the assistant.
3. **A browser version** using wllama (llama.cpp in WebAssembly and WebGPU) with Gemma 4 E2B, for phones and computers where nothing can be installed.

Decision deferred until Stage 2 ships; reviewed in the monthly technology review.

## Stage 4: private sync

End-to-end encrypted sync of the library between a person's devices, as set out in ADR 0016. Jan has no sync; this is Always's addition, contributed upstream if Jan wants it.

## Not in scope

- Always-run AI or sync servers.
- Rebranding Jan without attribution, or using Jan's name or logo for Always AI.
- Changing the theological boundary. Forks may add their own; see the README.

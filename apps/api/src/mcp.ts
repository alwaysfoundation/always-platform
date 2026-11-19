import type { Hono } from 'hono';
import type { Env } from './auth.js';

/**
 * The Always MCP server, version 1 (RFC 0001, part 3). Stateless, over Streamable HTTP at POST /mcp.
 *
 * Read-only and holds no personal data: every tool reads the same public endpoints a website can.
 * Nothing here can see a response, a person, an inbox, or any young person's information,
 * and nothing here can act. Later versions that help a team with adults who agreed to AI help
 * will need sign-in, the `ai.assist` consent purpose, and a person approving every action.
 */
const PROTOCOL = '2025-06-18';
const STEPS = ['church', 'explore', 'talk', 'youth', 'group', 'help', 'read'];

const TOOLS = [
  {
    name: 'find_churches',
    title: 'Find churches near a postcode',
    description: 'Find churches and ministries in Australia from the Always church feed, nearest first. Only churches that chose to be in the feed appear. Use welcoming=true for churches ready to welcome people this month, and youth=true for verified youth partners. Returns facts about churches only, never about people.',
    inputSchema: {
      type: 'object',
      properties: {
        postcode: { type: 'string', pattern: '^\\d{4}$', description: 'Australian postcode, like 2150' },
        step: { type: 'string', enum: STEPS, description: 'A next step the church offers' },
        welcoming: { type: 'boolean', description: 'Only churches welcoming people now' },
        youth: { type: 'boolean', description: 'Only verified youth partners' },
        radiusKm: { type: 'number', minimum: 1, maximum: 200 },
        limit: { type: 'number', minimum: 1, maximum: 25 },
      },
      required: ['postcode'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'verify_church',
    title: 'Check whether a church is verified',
    description: 'Check whether a church on Always is verified with its denomination or network, whether it is a verified youth partner, and whether it is welcoming people now. Takes the church slug from find_churches.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_events',
    title: 'List upcoming Christian events',
    description: 'Upcoming Christian events in Australia listed on Always: worship nights, outreach, youth camps, courses and training.',
    inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] }, limit: { type: 'number', minimum: 1, maximum: 50 } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'how_always_works',
    title: 'How Always works',
    description: 'A short guide to how Always connects someone who says yes to Jesus with a next step, the consent and age rules, and how developers can build on it. Use before explaining Always to someone.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

const GUIDE = `Always is a free, open-source network run by the Always Foundation in Australia.
When someone says yes to Jesus at church, a camp, an event or online, they choose what would help next
(a church, a course, someone to talk to, a youth group, reading the Bible). With their permission, Always
introduces them to one partner church or ministry nearby. The church accepts or passes; if it passes, the
next church nearby is asked. If no one can help, the Always care team does. A real person gets in touch.

Rules that never change: nothing is shared without the person's permission; their details stay in Australia
and go only to the church that welcomes them; under 15s need a parent or guardian and give their own agreement;
young people only meet verified youth partners; no AI ever touches a young person's information.

Builders: the church feed and verification are open (https://api.alwaysfoundation.org/v1/feed/churches,
/v1/verify/{slug}). Sending a person to a church uses the Handoff API with consent and needs a member key.
SDK: npm install @always/sdk. Docs: https://alwaysfoundation.org/#/docs`;

type RpcReq = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: any };

export function mountMcp(app: Hono<Env>) {
  const get = async (path: string) => {
    const res = await app.request(path);
    return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };

  async function callTool(name: string, args: any): Promise<{ text: string; structured?: unknown; isError?: boolean }> {
    if (name === 'how_always_works') return { text: GUIDE };
    if (name === 'find_churches') {
      if (!/^\d{4}$/.test(String(args?.postcode ?? ''))) return { text: 'Please give a four-digit Australian postcode.', isError: true };
      const q = new URLSearchParams({ postcode: String(args.postcode), limit: String(Math.min(Number(args.limit ?? 10), 25)) });
      if (args.step && STEPS.includes(args.step)) q.set('step', args.step);
      if (args.welcoming) q.set('welcoming', 'true');
      if (args.youth) q.set('youth', 'true');
      if (args.radiusKm) q.set('radiusKm', String(args.radiusKm));
      const r = await get(`/v1/feed/churches?${q}`);
      if (!r.ok) return { text: `The church feed returned ${r.status}.`, isError: true };
      const items = r.body.items as any[];
      const text = items.length
        ? items.map((c) => `- ${c.name} (${[c.suburb, c.denomination, c.distanceKm != null ? `${c.distanceKm} km` : null].filter(Boolean).join(', ')})${c.welcomingNow ? ', welcoming now' : ''}${c.youthPartner ? ', youth partner' : ''}. ${c.url}`).join('\n')
        : 'No churches in the Always feed near that postcode yet.';
      return { text, structured: { items } };
    }
    if (name === 'verify_church') {
      const r = await get(`/v1/verify/${encodeURIComponent(String(args?.slug ?? ''))}`);
      if (r.status === 404) return { text: 'No church with that slug on Always.', isError: true };
      const v = r.body;
      return { text: `${v.name}: ${v.verified ? 'verified' : 'not yet verified'}${v.youthPartner ? ', verified youth partner' : ''}${v.welcomingNow ? ', welcoming now' : ''}.`, structured: v };
    }
    if (name === 'list_events') {
      const q = new URLSearchParams({ limit: String(Math.min(Number(args?.limit ?? 10), 50)) });
      if (args?.state) q.set('state', args.state);
      const r = await get(`/v1/events?${q}`);
      const items = (r.body.items ?? []) as any[];
      return { text: items.length ? items.map((e) => `- ${e.title}, ${new Date(e.starts_at).toISOString().slice(0, 10)}${e.suburb ? `, ${e.suburb}` : ''}${e.url ? ` ${e.url}` : ''}`).join('\n') : 'No upcoming events listed.', structured: { items } };
    }
    return { text: `Unknown tool: ${name}`, isError: true };
  }

  async function handle(m: RpcReq) {
    const reply = (result: unknown) => ({ jsonrpc: '2.0', id: m.id ?? null, result });
    const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: m.id ?? null, error: { code, message } });
    switch (m.method) {
      case 'initialize':
        return reply({
          protocolVersion: PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'always', title: 'Always', version: '1.0.0' },
          instructions: 'Read-only tools for the Always network in Australia: find partner churches near a postcode, see which are partner churches, list events. No personal data is available here.',
        });
      case 'ping':
        return reply({});
      case 'tools/list':
        return reply({ tools: TOOLS });
      case 'tools/call': {
        const out = await callTool(m.params?.name, m.params?.arguments ?? {});
        return reply({ content: [{ type: 'text', text: out.text }], ...(out.structured ? { structuredContent: out.structured } : {}), isError: !!out.isError });
      }
      default:
        return fail(-32601, 'Method not found');
    }
  }

  app.post('/mcp', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
    const msgs: RpcReq[] = Array.isArray(body) ? body : [body];
    const out = [];
    for (const m of msgs) if (m.id !== undefined && m.id !== null) out.push(await handle(m));
    if (!out.length) return c.body(null, 202); // notifications only
    return c.json(Array.isArray(body) ? out : out[0]);
  });
  app.get('/llms.txt', (c) => c.text(`# Always API

> Open infrastructure from the Always Foundation (Australia) for evangelists, churches and ministries: find partner churches, see which are partner churches, list events, and hand someone a next step with their consent.

## Open, no personal data
- [Church feed](https://api.alwaysfoundation.org/v1/feed/churches?postcode=2150): churches near a postcode; filters welcoming, youth, step
- [Whole feed, JSON Lines](https://api.alwaysfoundation.org/v1/feed/churches.jsonl)
- [Verify a church](https://api.alwaysfoundation.org/v1/verify/{slug})
- [Events](https://api.alwaysfoundation.org/v1/events)
- [MCP server](https://api.alwaysfoundation.org/mcp): read-only tools find_churches, verify_church, list_events, how_always_works

## Members only, with consent
- Handoff API (POST /v1/responses): send a person who said yes to a church, with their consent receipt
- Church inbox, reports and webhooks

## Rules
${GUIDE}

## More
- [OpenAPI](https://github.com/alwaysfoundation/always-platform/blob/main/api/openapi.yaml)
- [SDK](https://www.npmjs.com/package/@always/sdk)
`));
  app.get('/mcp', (c) => c.json({ error: 'Use POST for MCP requests.' }, 405));
}

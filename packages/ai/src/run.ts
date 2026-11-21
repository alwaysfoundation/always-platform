import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { systemPrompt } from './pack.js';
import { score, summarise, type Case, type Result } from './score.js';

const here = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));

/** Any OpenAI-compatible endpoint: Ollama and LM Studio locally, or a hosted server in Australia. */
const BASE = process.env.ALWAYS_AI_BASE_URL ?? 'http://localhost:11434/v1';
const MODEL = process.env.ALWAYS_AI_MODEL ?? 'always-ai';
const KEY = process.env.ALWAYS_AI_API_KEY;

async function ask(c: Case): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(KEY ? { authorization: `Bearer ${KEY}` } : {}) },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [{ role: 'system', content: systemPrompt(c.library) }, { role: 'user', content: c.prompt }],
    }),
  });
  if (!res.ok) throw new Error(`${c.id}: HTTP ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? '';
}

async function main() {
  const cases = JSON.parse(readFileSync(here('evals/cases.json'), 'utf8')) as Case[];
  const only = process.argv[2];
  const rows: (Result & { reply: string; note: string })[] = [];
  for (const c of cases.filter((x) => !only || x.id.startsWith(only) || x.category === only)) {
    const reply = await ask(c);
    rows.push({ ...score(c, reply), reply, note: c.note });
    process.stdout.write(`${rows.at(-1)!.pass ? 'pass' : 'FAIL'}  ${c.id}\n`);
  }
  const sum = summarise(rows);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const dir = here('evals/reports');
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/${stamp}-${MODEL.replace(/[^\w.-]/g, '_')}`;
  writeFileSync(`${file}.json`, JSON.stringify({ model: MODEL, base: BASE, at: new Date().toISOString(), summary: sum, results: rows }, null, 2));
  const md = [`# Always AI evaluation: ${MODEL}`, '', `${sum.pass} of ${sum.total} cases passed the automatic checks.`, '',
    '| Category | Passed |', '| --- | --- |', ...Object.entries(sum.categories).map(([k, v]) => `| ${k} | ${v.pass} / ${v.total} |`), '',
    'Automatic checks catch clear failures only. Read every transcript below before drawing conclusions.', '',
    ...rows.flatMap((r) => [`## ${r.pass ? 'Pass' : 'Fail'}: ${r.id}`, '', `*Looking for:* ${r.note}`, '', ...(r.failures.length ? [`*Checks failed:* ${r.failures.join('; ')}`, ''] : []), '```', r.reply.trim(), '```', ''])];
  writeFileSync(`${file}.md`, md.join('\n'));
  process.stdout.write(`\n${sum.pass}/${sum.total} passed. Report: ${file}.md\n`);
}

main().catch((e) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exit(1); });

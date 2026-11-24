'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { Shell } from '@/lib/shell';
import { useOrg } from '@/lib/org';
import { Icon } from '@/lib/icons';
import { guard } from '@/lib/ai/guard';
import { system } from '@/lib/ai/prompt';
import { detect, MODELS, route, type Choice, type Device } from '@/lib/ai/router';
import { checkAnswer, isReference, lookUp, TRANSLATION, type Check, type Passage } from '@/lib/ai/scripture';
import { TEMPLATES } from '@/lib/ai/templates';

const LITE = ['Psalm 23', 'John 3:16-21', 'Romans 8:28-39', 'Philippians 2:5-11', 'Matthew 5:1-12', '1 Corinthians 13'];

export default function AlwaysAIPage() {
  return <Shell><Chat /></Shell>;
}

type Msg = { role: 'user' | 'assistant'; text: string; checks?: Check[]; passages?: Passage[]; note?: string; streaming?: boolean };
type Load = { state: 'idle' | 'loading' | 'ready' | 'error'; progress: number; text: string };

function Chat() {
  const { org } = useOrg();
  const [device, setDevice] = useState<Device | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [load, setLoad] = useState<Load>({ state: 'idle', progress: 0, text: '' });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const engine = useRef<MLCEngineInterface | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { void detect().then((d) => { setDevice(d); setChoice(route(d)?.choice ?? null); }); }, []);
  const asked = useRef(false);
  useEffect(() => {
    if (!device || asked.current) return;
    asked.current = true;
    const q = new URLSearchParams(location.search).get('q');
    if (q) { history.replaceState(null, '', location.pathname); void send(null, q.slice(0, 2000)); }
  }, [device]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (msgs.length) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);
  useEffect(() => {
    const t = box.current; if (!t) return;
    t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 220)}px`;
  }, [draft]);

  const options = useMemo(() => (device?.gpu ? Object.values(MODELS(device.f16)) : []), [device]);

  async function start() {
    if (!choice || engine.current) return engine.current;
    setLoad({ state: 'loading', progress: 0, text: 'Starting…' });
    try {
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
      const worker = new Worker(new URL('../../lib/ai/worker.ts', import.meta.url), { type: 'module' });
      engine.current = await CreateWebWorkerMLCEngine(worker, choice.id, {
        initProgressCallback: (p) => setLoad({ state: 'loading', progress: p.progress, text: friendly(p.text) }),
      });
      setLoad({ state: 'ready', progress: 1, text: '' });
      return engine.current;
    } catch {
      setLoad({ state: 'error', progress: 0, text: 'Always AI couldn’t start on this computer. Try a smaller model, or close other tabs and try again.' });
      return null;
    }
  }

  function applyTemplate(prompt: string) {
    setDraft(prompt);
    setTimeout(() => {
      const t = box.current; if (!t) return;
      t.focus();
      const a = prompt.indexOf('['), b = prompt.indexOf(']', a);
      if (a >= 0 && b > a) t.setSelectionRange(a, b + 1);
    }, 30);
  }

  async function send(e?: React.FormEvent | null, given?: string) {
    e?.preventDefault();
    const text = (given ?? draft).trim();
    if (!text || busy) return;
    setDraft('');
    const history = msgs;
    setMsgs((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    const push = (m: Msg) => setMsgs((all) => [...all, m]);

    const g = guard(text);
    if (g.stop) { push({ role: 'assistant', text: g.reply }); setBusy(false); return; }

    if (isReference(text)) {
      const ps = await lookUp(text);
      push(ps.length ? { role: 'assistant', text: '', passages: ps, note: 'Looked up exactly. No AI model was used.' } : { role: 'assistant', text: 'That reference doesn’t exist in the Bible. Check the book, chapter and verse.' });
      setBusy(false); return;
    }

    if (noGpu) {
      const ps = await lookUp(text);
      push(ps.length ? { role: 'assistant', text: '', passages: ps, note: 'Looked up exactly. Writing and planning need a laptop with Chrome or Edge.' }
        : { role: 'assistant', text: 'On this device Always AI can look up Scripture. Try a reference like Romans 8:28, or open Always AI on a laptop with Chrome or Edge to plan, draft and explain.' });
      setBusy(false); return;
    }

    const eng = engine.current ?? (await start());
    if (!eng) { setBusy(false); return; }
    const passages = await lookUp(text);
    setMsgs((m) => [...m, { role: 'assistant', text: '', streaming: true, passages: passages.length ? passages : undefined }]);
    try {
      const stream = await eng.chat.completions.create({
        stream: true, temperature: 0.4, max_tokens: 1100,
        messages: [
          { role: 'system', content: system(org?.name ?? 'your church', passages) },
          ...history.slice(-6).filter((m) => m.text).map((m) => ({ role: m.role, content: m.text })),
          { role: 'user', content: text },
        ],
        ...(choice?.id.startsWith('Qwen') ? { extra_body: { enable_thinking: false } } : {}),
      } as Parameters<MLCEngineInterface['chat']['completions']['create']>[0] & { stream: true });
      let out = '';
      for await (const chunk of stream) {
        out += chunk.choices[0]?.delta?.content ?? '';
        const shown = clean(out);
        setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, text: shown } : x)));
      }
      const final = clean(out);
      const checks = await checkAnswer(final);
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, text: final, checks, streaming: false } : x)));
    } catch {
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, text: 'Something went wrong while writing that. Please try again.', streaming: false } : x)));
    }
    setBusy(false);
  }

  const empty = msgs.length === 0;
  const noGpu = device && !device.gpu;

  return (
    <div className="aic">
      <header className="aic-top">
        <div>
          <h1><Icon name="ai" size={18} />Always AI</h1>
          <p className="aic-sub"><i className={`aic-dot ${load.state === 'ready' ? 'on' : ''}`} aria-hidden="true" />
            {noGpu ? 'Scripture on this device' : load.state === 'ready' ? `Running on this computer with ${choice?.name}` : 'Runs privately on this computer'}</p>
        </div>
        {!empty && <button className="btn btn-line" onClick={() => setMsgs([])}>New conversation</button>}
      </header>

      <div className="aic-scroll" aria-live="polite">
        {empty && (
          <div className="aic-welcome">
            <h2>What are you preparing?</h2>
            <p>{noGpu ? 'Type any reference, like John 3:16 or Psalm 23, and read it exactly as written. Nothing you type leaves this device.' : 'Ask about a passage, plan a series, or start from one of these. Scripture is looked up word for word, and nothing you type leaves this computer.'}</p>
            {noGpu && (
              <section className="aic-lite" aria-labelledby="aic-lite-h">
                <h3 id="aic-lite-h">Read a passage</h3>
                <div className="aic-refs">
                  {LITE.map((r) => <button key={r} type="button" onClick={() => void send(null, r)}>{r}</button>)}
                </div>
                <p className="aic-lite-note"><Icon name="ai" size={16} />On this device Always AI looks up Scripture word for word. To plan a series, draft or explain, open it on a laptop with Chrome or Edge.</p>
              </section>
            )}
            {!noGpu && (['Prepare', 'Welcome', 'Lead'] as const).map((g) => (
              <section key={g} className="aic-group" aria-label={g}>
                <h3>{g === 'Prepare' ? 'Prepare to preach and teach' : g === 'Welcome' ? 'Welcome people' : 'Lead your team'}</h3>
                <div className="aic-tpl">
                  {TEMPLATES.filter((t) => t.group === g).map((t) => (
                    <button key={t.title} type="button" onClick={() => applyTemplate(t.prompt)}>
                      <b>{t.title}</b><span>{t.prompt.replace(/[[\]]/g, '')}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={`aic-msg ${m.role}`}>
            {m.role === 'user' ? <p>{m.text}</p> : (
              <>
                {m.passages && m.passages.map((p) => <PassageCard key={p.reference} p={p} />)}
                {m.text && <div className="aic-md">{render(m.text)}</div>}
                {m.streaming && !m.text && <p className="aic-typing"><span /><span /><span /></p>}
                {m.note && <p className="aic-note">{m.note}</p>}
                {!!m.checks?.length && <Checks checks={m.checks} />}
              </>
            )}
          </div>
        ))}
        <div ref={end} className="aic-end" />
      </div>

      <div className="aic-bottom">
        {!noGpu && load.state !== 'ready' && choice && (
          <div className="aic-setup">
            {load.state === 'loading' ? (
              <div className="aic-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(load.progress * 100)}>
                <div><b>Setting up Always AI</b><span>{load.text}</span></div>
                <i style={{ width: `${Math.max(4, load.progress * 100)}%` }} />
              </div>
            ) : (
              <>
                <p><b>{choice.name}</b> suits this computer. It downloads once ({choice.size}), then starts in seconds and works offline.{load.state === 'error' && <span className="aic-err"> {load.text}</span>}</p>
                <div className="row">
                  <label className="aic-model"><span className="sr-only">Model</span>
                    <select value={choice.id} onChange={(e) => setChoice(options.find((o) => o.id === e.target.value) ?? choice)}>
                      {options.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.size})</option>)}
                    </select>
                  </label>
                  <button className="btn btn-brand" onClick={() => void start()}>Set up</button>
                </div>
              </>
            )}
          </div>
        )}
        <form className="aic-compose" onSubmit={send}>
          <label className="sr-only" htmlFor="aic-input">Ask Always AI</label>
          <textarea id="aic-input" ref={box} rows={1} value={draft} placeholder={noGpu ? 'Look up a passage, like Romans 8:28' : 'Ask about a passage, or plan your next series…'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button className="aic-send" type="submit" disabled={busy || !draft.trim()} aria-label="Send">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
          </button>
        </form>
        <p className="aic-fine">Private: nothing you type leaves this device, and the conversation disappears when you close the tab. Check what it says against Scripture. Not for counselling or anyone under 18.</p>
      </div>
    </div>
  );
}

function PassageCard({ p }: { p: Passage }) {
  return (
    <figure className="aic-passage">
      <blockquote>{p.verses.map((v) => <span key={`${v.chapter}:${v.verse}`}><sup>{v.verse}</sup>{v.text} </span>)}</blockquote>
      <figcaption>{p.reference}, {p.translation}</figcaption>
    </figure>
  );
}

function Checks({ checks }: { checks: Check[] }) {
  return (
    <details className="aic-checks">
      <summary>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        Scripture checked: {checks.length} {checks.length === 1 ? 'reference' : 'references'}
        {checks.some((c) => !c.ok) && <em>, {checks.filter((c) => !c.ok).length} to fix</em>}
      </summary>
      <ul>
        {checks.map((c) => (
          <li key={c.reference} className={c.ok ? (c.quote === 'close' ? 'close' : 'ok') : 'bad'}>
            <b>{c.reference}</b>
            <span>{!c.ok ? (c.problem ?? 'The quotation doesn’t match this passage. Use the text below.') : c.quote === 'exact' ? 'Quoted exactly.' : c.quote === 'close' ? 'Close, but not word for word. The exact text is below.' : 'Reference exists.'}</span>
            {c.text && <q>{c.text}</q>}
          </li>
        ))}
      </ul>
      <p>Checked against the {TRANSLATION}.</p>
    </details>
  );
}

const friendly = (t: string) => {
  const m = t.match(/(\d+)%/);
  if (/fetch|download|cache/i.test(t)) return m ? `Downloading the model, ${m[1]}% done. This happens once.` : 'Downloading the model. This happens once.';
  if (/load|gpu|shader/i.test(t)) return 'Getting it ready on this computer…';
  return 'Starting…';
};

const clean = (s: string) => s.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trimStart();

/** A small, safe Markdown renderer: headings, lists, bold, italics and paragraphs. No HTML from the model. */
function render(md: string): React.ReactNode {
  const inline = (s: string, k: string) => s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={k + i}>{part.slice(2, -2)}</strong> : part.startsWith('*') && part.length > 2 ? <em key={k + i}>{part.slice(1, -1)}</em> : part);
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `l${out.length}-${i}`)}</li>);
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    list = null;
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const h = line.match(/^#{1,4}\s+(.*)/);
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ul ?? ol)![1]!);
      continue;
    }
    flush();
    if (h) out.push(<h4 key={out.length}>{inline(h[1]!, `h${out.length}`)}</h4>);
    else if (line.trim()) out.push(<p key={out.length}>{inline(line, `p${out.length}`)}</p>);
  }
  flush();
  return out;
}


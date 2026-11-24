'use client';
/**
 * Always Scripture in the browser: exact Bible text and quote checks, with no model and no network
 * after the first download. Same parser and checks as the Always Scripture MCP server.
 */
import { findReferences, formatReference, parseReference, type Ref } from './refs';

export type Passage = { reference: string; translation: string; verses: { chapter: number; verse: number; text: string }[] };
export type Check = { reference: string; ok: boolean; text?: string; problem?: string; quote?: 'exact' | 'close' | 'different' };

export const TRANSLATION = 'Berean Standard Bible';
let books: Promise<Record<string, string[][]>> | null = null;

function load() {
  books ??= fetch('/scripture/bsb.json.gz')
    .then((r) => new Response(r.body!.pipeThrough(new DecompressionStream('gzip'))).json())
    .then((d: { books: Record<string, string[][]> }) => d.books);
  return books;
}

export async function passage(ref: Ref): Promise<Passage | { error: string }> {
  const book = (await load())[ref.book];
  if (!book) return { error: `${formatReference(ref)} is not in the ${TRANSLATION}.` };
  if (ref.chapter < 1 || ref.endChapter > book.length || ref.endChapter < ref.chapter) return { error: `${formatReference(ref)} doesn't exist: this book has ${book.length} chapters.` };
  const verses: Passage['verses'] = [];
  for (let c = ref.chapter; c <= ref.endChapter; c++) {
    const ch = book[c - 1]!;
    const from = c === ref.chapter && ref.verse != null ? ref.verse : 1;
    const to = c === ref.endChapter && ref.endVerse != null ? ref.endVerse : ch.length;
    if (from < 1 || to > ch.length || to < from) return { error: `${formatReference(ref)} doesn't exist: chapter ${c} has ${ch.length} verses.` };
    for (let v = from; v <= to; v++) verses.push({ chapter: c, verse: v, text: ch[v - 1]! });
  }
  if (verses.length > 60) return { error: 'That passage is long. Ask for 60 verses or fewer.' };
  return { reference: formatReference(ref), translation: TRANSLATION, verses };
}

export const passageText = (p: Passage) => p.verses.map((v) => v.text).join(' ');

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

function similarity(quote: string, text: string) {
  const count = (s: string) => { const m = new Map<string, number>(); for (const w of norm(s).split(' ').filter(Boolean)) m.set(w, (m.get(w) ?? 0) + 1); return m; };
  const Q = count(quote), P = count(text);
  let hit = 0, total = 0;
  for (const [w, n] of Q) { hit += Math.min(n, P.get(w) ?? 0); total += n; }
  return total ? hit / total : 0;
}

/** The passages a message refers to, looked up exactly. */
export async function lookUp(text: string) {
  const out: Passage[] = [];
  for (const r of findReferences(text).slice(0, 6)) { const p = await passage(r); if (!('error' in p)) out.push(p); }
  return out;
}

/** True when a message is only a Bible reference, so no model is needed. */
export const isReference = (text: string) => !!parseReference(text.replace(/^(show me|read|look up|open)\s+/i, '').trim());

/** Checks every reference in an answer, and any quotation that follows one. */
export async function checkAnswer(answer: string): Promise<Check[]> {
  const out: Check[] = [];
  const seen = new Set<string>();
  for (const r of findReferences(answer).slice(0, 12)) {
    const key = formatReference(r);
    if (seen.has(key)) continue;
    seen.add(key);
    const p = await passage(r);
    if ('error' in p) { out.push({ reference: key, ok: false, problem: p.error }); continue; }
    const text = passageText(p);
    const after = answer.slice(answer.indexOf(r.text) + r.text.length, answer.indexOf(r.text) + r.text.length + 400);
    const before = answer.slice(Math.max(0, answer.indexOf(r.text) - 400), answer.indexOf(r.text));
    const q = (after.match(/[“"]([^”"]{12,})[”"]/) ?? before.match(/[“"]([^”"]{12,})[”"][^“"]*$/))?.[1];
    if (!q) { out.push({ reference: key, ok: true, text }); continue; }
    const exact = norm(text).includes(norm(q));
    const score = exact ? 1 : similarity(q, text);
    const verdict = exact ? 'exact' : score >= 0.6 ? 'close' : 'different';
    out.push({ reference: key, ok: verdict !== 'different', text, quote: verdict });
  }
  return out;
}

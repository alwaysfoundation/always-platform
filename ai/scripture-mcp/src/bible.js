import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { formatReference } from './refs.js'

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
export const TRANSLATIONS = JSON.parse(readFileSync(join(DATA, 'translations.json'), 'utf8'))
export const DEFAULT_TRANSLATION = 'BSB'
const cache = new Map()

export function findTranslation(id) {
  const want = String(id || DEFAULT_TRANSLATION).toUpperCase()
  return TRANSLATIONS.find((t) => t.id === want) || null
}

function load(id) {
  if (!cache.has(id)) {
    const raw = gunzipSync(readFileSync(join(DATA, id.toLowerCase() + '.json.gz'))).toString('utf8')
    cache.set(id, JSON.parse(raw).books)
  }
  return cache.get(id)
}

// Returns { reference, translation, verses: [{ chapter, verse, text }] } or { error }.
export function getPassage(ref, translationId) {
  const t = findTranslation(translationId)
  if (!t) return { error: `Unknown translation "${translationId}". Use list_translations to see what is available.` }
  const book = load(t.id)[ref.book]
  if (!book) return { error: `${t.name} does not include this book.` }
  const lastCh = ref.endChapter
  if (ref.chapter < 1 || lastCh > book.length || lastCh < ref.chapter) return { error: `${formatReference(ref)} does not exist: this book has ${book.length} chapters.` }
  const verses = []
  for (let c = ref.chapter; c <= lastCh; c++) {
    const chapter = book[c - 1]
    const from = c === ref.chapter && ref.verse != null ? ref.verse : 1
    const to = c === lastCh && ref.endVerse != null ? ref.endVerse : chapter.length
    if (from < 1 || from > chapter.length || to > chapter.length || to < from) {
      return { error: `${formatReference(ref)} does not exist: chapter ${c} has ${chapter.length} verses.` }
    }
    for (let v = from; v <= to; v++) verses.push({ chapter: c, verse: v, text: chapter[v - 1] })
  }
  if (verses.length > 200) return { error: 'That passage is longer than 200 verses. Ask for a shorter range.' }
  return { reference: formatReference(ref), translation: t, verses }
}

export function passageText(p) {
  const multi = p.verses.some((v) => v.chapter !== p.verses[0].chapter)
  return p.verses.map((v) => `[${multi ? v.chapter + ':' : ''}${v.verse}] ${v.text}`).join(' ')
}

const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

// Similarity of a quotation to the passage: the share of the quotation's words found in the
// passage, in order-insensitive multiset form (0 to 1). Short or reworded quotes still score well
// when they draw on the passage's wording; unrelated text scores low.
export function similarity(quote, passage) {
  const count = (s) => { const m = new Map(); for (const w of norm(s).split(' ').filter(Boolean)) m.set(w, (m.get(w) || 0) + 1); return m }
  const Q = count(quote), P = count(passage)
  let hit = 0, total = 0
  for (const [w, n] of Q) { hit += Math.min(n, P.get(w) || 0); total += n }
  return total ? hit / total : 0
}

export function verifyQuote(ref, quote, translationId) {
  const p = getPassage(ref, translationId)
  if (p.error) return p
  const actual = p.verses.map((v) => v.text).join(' ')
  const exact = norm(actual).includes(norm(quote)) && norm(quote).length > 0
  const score = exact ? 1 : similarity(quote, actual)
  const verdict = exact ? 'exact' : score >= 0.6 ? 'close' : 'different'
  return { reference: p.reference, translation: p.translation, verdict, similarity: Math.round(score * 100) / 100, text: actual }
}

export function search(query, translationId, limit = 10) {
  const t = findTranslation(translationId)
  if (!t) return { error: `Unknown translation "${translationId}".` }
  const words = norm(query).split(' ').filter((w) => w.length > 1)
  if (!words.length) return { error: 'Give at least one word to search for.' }
  const results = []
  for (const [book, chapters] of Object.entries(load(t.id))) {
    if (book.startsWith('X:')) continue
    chapters.forEach((verses, ci) => verses.forEach((text, vi) => {
      const n = norm(text)
      if (words.every((w) => n.includes(w))) results.push({ reference: formatReference({ book, chapter: ci + 1, verse: vi + 1, endChapter: ci + 1, endVerse: vi + 1 }), text })
    }))
    if (results.length >= limit) break
  }
  return { translation: t, results: results.slice(0, Math.min(limit, 50)) }
}

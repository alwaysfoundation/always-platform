// Parses English Bible references such as "John 3:16", "1 Cor 13:4-7", "Ps 23",
// "Romans 8:28-9:2". Returns null for anything it cannot read with confidence.

export const BOOKS = [
  ['GEN', 'Genesis', ['gen', 'ge', 'gn']], ['EXO', 'Exodus', ['exod', 'exo', 'ex']],
  ['LEV', 'Leviticus', ['lev', 'le', 'lv']], ['NUM', 'Numbers', ['num', 'nu', 'nm']],
  ['DEU', 'Deuteronomy', ['deut', 'deu', 'dt']], ['JOS', 'Joshua', ['josh', 'jos']],
  ['JDG', 'Judges', ['judg', 'jdg', 'jg']], ['RUT', 'Ruth', ['ruth', 'ru']],
  ['1SA', '1 Samuel', ['1 sam', '1 sa', '1sam', '1sa', 'i samuel', 'first samuel']],
  ['2SA', '2 Samuel', ['2 sam', '2 sa', '2sam', '2sa', 'ii samuel', 'second samuel']],
  ['1KI', '1 Kings', ['1 kgs', '1 ki', '1kgs', '1ki', 'i kings', 'first kings']],
  ['2KI', '2 Kings', ['2 kgs', '2 ki', '2kgs', '2ki', 'ii kings', 'second kings']],
  ['1CH', '1 Chronicles', ['1 chr', '1 ch', '1chr', '1ch', 'i chronicles']],
  ['2CH', '2 Chronicles', ['2 chr', '2 ch', '2chr', '2ch', 'ii chronicles']],
  ['EZR', 'Ezra', ['ezr']], ['NEH', 'Nehemiah', ['neh', 'ne']], ['EST', 'Esther', ['esth', 'est']],
  ['JOB', 'Job', ['jb']], ['PSA', 'Psalms', ['psalm', 'pss', 'psa', 'ps']],
  ['PRO', 'Proverbs', ['prov', 'pro', 'pr', 'prv']], ['ECC', 'Ecclesiastes', ['eccl', 'eccles', 'ecc', 'qoh']],
  ['SNG', 'Song of Songs', ['song of solomon', 'song', 'sos', 'canticles']],
  ['ISA', 'Isaiah', ['isa', 'is']], ['JER', 'Jeremiah', ['jer', 'je']], ['LAM', 'Lamentations', ['lam', 'la']],
  ['EZK', 'Ezekiel', ['ezek', 'eze', 'ezk']], ['DAN', 'Daniel', ['dan', 'da', 'dn']],
  ['HOS', 'Hosea', ['hos', 'ho']], ['JOL', 'Joel', ['joel', 'jl']], ['AMO', 'Amos', ['am']],
  ['OBA', 'Obadiah', ['obad', 'ob']], ['JON', 'Jonah', ['jon', 'jnh']], ['MIC', 'Micah', ['mic', 'mi']],
  ['NAM', 'Nahum', ['nah', 'na']], ['HAB', 'Habakkuk', ['hab', 'hb']], ['ZEP', 'Zephaniah', ['zeph', 'zep']],
  ['HAG', 'Haggai', ['hag', 'hg']], ['ZEC', 'Zechariah', ['zech', 'zec']], ['MAL', 'Malachi', ['mal']],
  ['MAT', 'Matthew', ['matt', 'mat', 'mt']], ['MRK', 'Mark', ['mrk', 'mk', 'mar']],
  ['LUK', 'Luke', ['luk', 'lk']], ['JHN', 'John', ['jhn', 'jn', 'joh']], ['ACT', 'Acts', ['act', 'ac']],
  ['ROM', 'Romans', ['rom', 'ro', 'rm']],
  ['1CO', '1 Corinthians', ['1 cor', '1 co', '1cor', '1co', 'i corinthians', 'first corinthians']],
  ['2CO', '2 Corinthians', ['2 cor', '2 co', '2cor', '2co', 'ii corinthians', 'second corinthians']],
  ['GAL', 'Galatians', ['gal', 'ga']], ['EPH', 'Ephesians', ['eph', 'ephes']],
  ['PHP', 'Philippians', ['phil', 'php', 'pp']], ['COL', 'Colossians', ['col']],
  ['1TH', '1 Thessalonians', ['1 thess', '1 th', '1thess', '1th', 'i thessalonians']],
  ['2TH', '2 Thessalonians', ['2 thess', '2 th', '2thess', '2th', 'ii thessalonians']],
  ['1TI', '1 Timothy', ['1 tim', '1 ti', '1tim', '1ti', 'i timothy']],
  ['2TI', '2 Timothy', ['2 tim', '2 ti', '2tim', '2ti', 'ii timothy']],
  ['TIT', 'Titus', ['tit']], ['PHM', 'Philemon', ['philem', 'phm', 'phlm']],
  ['HEB', 'Hebrews', ['heb']], ['JAS', 'James', ['jas', 'jm']],
  ['1PE', '1 Peter', ['1 pet', '1 pe', '1pet', '1pe', 'i peter']],
  ['2PE', '2 Peter', ['2 pet', '2 pe', '2pet', '2pe', 'ii peter']],
  ['1JN', '1 John', ['1 jn', '1jn', '1 john', 'i john', '1john']],
  ['2JN', '2 John', ['2 jn', '2jn', 'ii john', '2john']],
  ['3JN', '3 John', ['3 jn', '3jn', 'iii john', '3john']],
  ['JUD', 'Jude', ['jud', 'jd']], ['REV', 'Revelation', ['rev', 're', 'revelation of john', 'apocalypse']],
]

const ALIAS = new Map()
for (const [code, name, alts] of BOOKS) {
  for (const a of [name, ...alts]) ALIAS.set(a.toLowerCase(), code)
}
export const BOOK_NAME = Object.fromEntries(BOOKS.map(([c, n]) => [c, n]))

const SORTED_ALIASES = [...ALIAS.keys()].sort((a, b) => b.length - a.length)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const BOOK_RE = SORTED_ALIASES.map((a) => esc(a).replace(/ /g, '\\s*')).join('|')
// book, chapter, optional verse, optional range end (verse, or chapter:verse)
const REF_RE = new RegExp(`(?<![\\p{L}\\d])(${BOOK_RE})\\.?\\s*(\\d{1,3})(?:\\s*[:.]\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3})(?:\\s*[:.]\\s*(\\d{1,3}))?)?)?(?![\\p{L}\\d])`, 'giu')

function toCode(bookText) {
  return ALIAS.get(bookText.toLowerCase().replace(/\s+/g, ' ').replace(/^(\d)\s*/, '$1 ')) ||
    ALIAS.get(bookText.toLowerCase().replace(/\s+/g, ''))
}

function build(m) {
  const code = toCode(m[1])
  if (!code) return null
  const ch = Number(m[2])
  const v1 = m[3] ? Number(m[3]) : null
  let endCh = ch
  let v2 = v1
  if (m[4] && m[5]) { endCh = Number(m[4]); v2 = Number(m[5]) } else if (m[4]) { v2 = Number(m[4]) }
  return { book: code, chapter: ch, verse: v1, endChapter: endCh, endVerse: v2, text: m[0].trim() }
}

export function parseReference(input) {
  if (typeof input !== 'string') return null
  REF_RE.lastIndex = 0
  const m = REF_RE.exec(input.trim())
  if (!m || m.index !== 0 || m[0].trim().length !== input.trim().replace(/[.;,]+$/, '').length) return null
  return build(m)
}

export function findReferences(text) {
  const out = []
  if (typeof text !== 'string') return out
  REF_RE.lastIndex = 0
  let m
  while ((m = REF_RE.exec(text))) {
    const r = build(m)
    if (r) out.push(r)
  }
  return out
}

export function formatReference(r) {
  const name = BOOK_NAME[r.book] || r.book
  if (r.verse == null) return `${name} ${r.chapter}`
  if (r.endChapter !== r.chapter) return `${name} ${r.chapter}:${r.verse}-${r.endChapter}:${r.endVerse}`
  if (r.endVerse !== r.verse) return `${name} ${r.chapter}:${r.verse}-${r.endVerse}`
  return `${name} ${r.chapter}:${r.verse}`
}

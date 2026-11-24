import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseReference, findReferences, formatReference } from '../src/refs.js'
import { getPassage, verifyQuote, search, TRANSLATIONS } from '../src/bible.js'
import { handle, callTool, TOOLS } from '../src/server.js'

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server.js')

test('parses common reference forms', () => {
  const cases = {
    'John 3:16': ['JHN', 3, 16, 3, 16],
    'Jn 3:16-18': ['JHN', 3, 16, 3, 18],
    '1 Cor 13:4-7': ['1CO', 13, 4, 13, 7],
    '1Co 13:4': ['1CO', 13, 4, 13, 4],
    'Psalm 23': ['PSA', 23, null, 23, null],
    'Ps 23:1': ['PSA', 23, 1, 23, 1],
    'Romans 8:38-9:2': ['ROM', 8, 38, 9, 2],
    'Song of Solomon 2:4': ['SNG', 2, 4, 2, 4],
    '1 John 4:8': ['1JN', 4, 8, 4, 8],
    'Revelation 21:4': ['REV', 21, 4, 21, 4],
  }
  for (const [input, [book, ch, v, ech, ev]] of Object.entries(cases)) {
    const r = parseReference(input)
    assert.ok(r, input)
    assert.deepEqual([r.book, r.chapter, r.verse, r.endChapter, r.endVerse], [book, ch, v, ech, ev], input)
  }
})

test('rejects text that is not a reference', () => {
  for (const s of ['', 'hello', 'John', 'Johnny 3:16', '3:16']) assert.equal(parseReference(s), null, s)
})

test('finds references inside prose', () => {
  const refs = findReferences('As Jesus said in John 14:6, and Paul in Rom 8:28 and 1 Cor 15:3-4, see also Hezekiah 3:1.')
  assert.deepEqual(refs.map(formatReference), ['John 14:6', 'Romans 8:28', '1 Corinthians 15:3-4'])
})

test('returns the exact BSB text of John 3:16', () => {
  const p = getPassage(parseReference('John 3:16'))
  assert.equal(p.verses.length, 1)
  assert.equal(p.verses[0].text, 'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.')
})

test('reports passages that do not exist', () => {
  assert.match(getPassage(parseReference('John 22:1')).error, /21 chapters/)
  assert.match(getPassage(parseReference('John 3:99')).error, /36 verses/)
  assert.match(getPassage(parseReference('Jude 2:1')).error, /1 chapters/)
})

test('every translation loads and has the 66 books', () => {
  for (const t of TRANSLATIONS) {
    assert.deepEqual(t.missing_books, [], t.id)
    const p = getPassage(parseReference('Genesis 1:1'), t.id)
    assert.ok(!p.error && p.verses[0].text.length > 10, t.id)
  }
})

test('verifies quotes', () => {
  const r = parseReference('John 3:16')
  assert.equal(verifyQuote(r, 'For God so loved the world').verdict, 'exact')
  assert.equal(verifyQuote(r, 'For God so loved the world that he gave his only begotten Son, that whosoever believeth in him should not perish').verdict, 'close')
  assert.equal(verifyQuote(r, 'The Lord is my shepherd, I shall not want').verdict, 'different')
})

test('searches a translation', () => {
  const r = search('shepherd want', 'BSB', 5)
  assert.ok(r.results.some((x) => x.reference === 'Psalms 23:1'))
})

test('tools: check_references flags an invented verse', () => {
  const out = JSON.parse(callTool('check_references', { text: 'See John 3:16 and John 3:99.' }).content[0].text)
  assert.equal(out.found, 2)
  assert.equal(out.references[0].exists, true)
  assert.equal(out.references[1].exists, false)
})

test('tools: creed is the 381 text without the filioque', () => {
  const c = JSON.parse(callTool('nicene_creed').content[0].text)
  assert.match(c.text, /who proceeds from the Father;/)
  assert.doesNotMatch(c.text, /proceeds from the Father and the Son/)
  assert.ok(c.propositions.length >= 12)
})

test('protocol: initialize, list and call', () => {
  const init = handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })
  assert.equal(init.result.protocolVersion, '2025-06-18')
  assert.equal(handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null)
  assert.equal(handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }).result.tools.length, TOOLS.length)
  const call = handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_passage', arguments: { reference: 'Ps 23:1' } } })
  assert.match(call.result.content[0].text, /shepherd/)
  assert.equal(handle({ jsonrpc: '2.0', id: 4, method: 'nope' }).error.code, -32601)
})

test('stdio: the server answers over stdin and stdout', async () => {
  const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'inherit'] })
  const lines = []
  child.stdout.setEncoding('utf8')
  let buf = ''
  const done = new Promise((resolve) => child.stdout.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1) }
    if (lines.length >= 2) resolve()
  }))
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }) + '\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_passage', arguments: { reference: 'John 11:35' } } }) + '\n')
  await done
  child.kill()
  assert.equal(lines[0].result.serverInfo.name, 'always-scripture')
  assert.match(lines[1].result.content[0].text, /Jesus wept/)
})

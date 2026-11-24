#!/usr/bin/env node
// Always Scripture: a Model Context Protocol server over stdio. No network access and no
// dependencies, so it runs under Jan's bundled runtime and works offline.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseReference, findReferences, formatReference } from './refs.js'
import { TRANSLATIONS, DEFAULT_TRANSLATION, getPassage, passageText, verifyQuote, search } from './bible.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = JSON.parse(readFileSync(join(HERE, '..', '..', 'package.json'), 'utf8'))
const CREED = JSON.parse(readFileSync(join(HERE, '..', 'data', 'creed.json'), 'utf8'))
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05']

const translationProp = { type: 'string', description: `Translation id, default ${DEFAULT_TRANSLATION}. One of: ${TRANSLATIONS.map((t) => t.id).join(', ')}.` }

export const TOOLS = [
  {
    name: 'get_passage',
    description: 'Return the exact text of a Bible passage from a bundled open translation. Always use this to quote Scripture; never quote from memory.',
    inputSchema: { type: 'object', properties: { reference: { type: 'string', description: 'English reference, for example "John 3:16", "1 Cor 13:4-7" or "Psalm 23".' }, translation: translationProp }, required: ['reference'] },
  },
  {
    name: 'verify_quote',
    description: 'Check whether a quotation matches the Bible text at a reference. Returns exact, close or different, with the correct text.',
    inputSchema: { type: 'object', properties: { reference: { type: 'string' }, quote: { type: 'string' }, translation: translationProp }, required: ['reference', 'quote'] },
  },
  {
    name: 'check_references',
    description: 'Find every Bible reference in a piece of text and report whether each one exists. Use before giving an answer that cites Scripture.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'search_scripture',
    description: 'Find verses containing all of the given words in a bundled translation.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, translation: translationProp, limit: { type: 'number', minimum: 1, maximum: 50, default: 10 } }, required: ['query'] },
  },
  {
    name: 'list_translations',
    description: 'List the bundled Bible translations, their languages and licences.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'nicene_creed',
    description: 'Return the Nicene Creed (AD 381), notes on the text, the propositions drawn from it, and the historic errors it excludes. Use to check answers about God, Christ, the Holy Spirit and the Church.',
    inputSchema: { type: 'object', properties: {} },
  },
]

const ok = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] })
const fail = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true })
const credit = (t) => `${t.name} (${t.id}), ${t.licence}.${t.note ? ' ' + t.note : ''}`

export function callTool(name, args = {}) {
  switch (name) {
    case 'get_passage': {
      const ref = parseReference(args.reference)
      if (!ref) return fail(`Could not read "${args.reference}" as a Bible reference. Try a form like "John 3:16".`)
      const p = getPassage(ref, args.translation)
      if (p.error) return fail(p.error)
      return ok(`${p.reference} (${p.translation.id})\n${passageText(p)}\n\nSource: ${credit(p.translation)}`)
    }
    case 'verify_quote': {
      const ref = parseReference(args.reference)
      if (!ref) return fail(`Could not read "${args.reference}" as a Bible reference.`)
      const r = verifyQuote(ref, String(args.quote || ''), args.translation)
      if (r.error) return fail(r.error)
      return ok({ reference: r.reference, translation: r.translation.id, verdict: r.verdict, similarity: r.similarity, correct_text: r.text })
    }
    case 'check_references': {
      const refs = findReferences(String(args.text || ''))
      return ok({
        found: refs.length,
        references: refs.map((r) => {
          const p = getPassage(r, DEFAULT_TRANSLATION)
          return { as_written: r.text, reference: formatReference(r), exists: !p.error, ...(p.error ? { problem: p.error } : {}) }
        }),
      })
    }
    case 'search_scripture': {
      const r = search(String(args.query || ''), args.translation, Number(args.limit) || 10)
      if (r.error) return fail(r.error)
      return ok({ translation: r.translation.id, results: r.results })
    }
    case 'list_translations':
      return ok(TRANSLATIONS.map(({ id, name, language, licence, note }) => ({ id, name, language, licence, note })))
    case 'nicene_creed':
      return ok(CREED)
    default:
      return fail(`Unknown tool: ${name}`)
  }
}

export function handle(msg) {
  const { id, method, params } = msg
  const reply = (result) => ({ jsonrpc: '2.0', id, result })
  const error = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
  if (id === undefined || id === null) return null // notification
  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion
      return reply({
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'always-scripture', version: PKG.version },
        instructions: 'Quote Scripture only through get_passage, and check references with check_references before answering. Use nicene_creed to check doctrine.',
      })
    }
    case 'ping': return reply({})
    case 'tools/list': return reply({ tools: TOOLS })
    case 'tools/call': {
      try { return reply(callTool(params?.name, params?.arguments || {})) } catch (e) { return reply(fail('The tool failed: ' + String(e.message || e))) }
    }
    default: return error(-32601, `Method not found: ${method}`)
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === (await import('node:fs')).realpathSync(process.argv[1])
if (isMain) {
  const rl = createInterface({ input: process.stdin, terminal: false })
  rl.on('line', (line) => {
    if (!line.trim()) return
    let msg
    try { msg = JSON.parse(line) } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); return }
    const out = handle(msg)
    if (out) process.stdout.write(JSON.stringify(out) + '\n')
  })
}

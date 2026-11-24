// The browser build of Always AI uses the same reference parser and Bible text as Always Scripture.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const AI = new URL('../../../ai/scripture-mcp/', import.meta.url);
mkdirSync(new URL('../public/scripture/', import.meta.url), { recursive: true });
copyFileSync(new URL('data/bsb.json.gz', AI), new URL('../public/scripture/bsb.json.gz', import.meta.url));
writeFileSync(new URL('../lib/ai/refs.js', import.meta.url),
  '// Copied from ai/scripture-mcp/src/refs.js by scripts/copy-scripture.mjs. Edit the original.\n' + readFileSync(new URL('src/refs.js', AI), 'utf8'));

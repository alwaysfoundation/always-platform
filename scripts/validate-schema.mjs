// Compiles the Always Pathway standard's JSON Schema (draft 2020-12) so a broken schema fails CI.
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const file = process.argv[2] ?? 'spec/schemas/handoff-standard.schema.json';
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.compile(JSON.parse(readFileSync(file, 'utf8')));
console.log(`${file}: valid JSON Schema`);

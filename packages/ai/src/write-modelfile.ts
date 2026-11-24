import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { modelfile } from './pack.js';

writeFileSync(fileURLToPath(new URL('../Modelfile', import.meta.url)), modelfile(process.argv[2]));

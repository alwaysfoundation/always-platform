import { fileURLToPath } from 'node:url';
import { connect, migrate } from '@always/db';

const sql = connect();
const applied = await migrate(sql, fileURLToPath(new URL('../db/migrations', import.meta.url)));
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
await sql.end();

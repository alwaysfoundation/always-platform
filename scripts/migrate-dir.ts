import { connect, migrate } from '@always/db';

const dir = process.argv[2];
if (!dir) throw new Error('Usage: migrate-dir.ts <directory of migrations>');
const sql = connect();
const applied = await migrate(sql, dir);
console.log(`Applied ${applied.length}`);
await sql.end();

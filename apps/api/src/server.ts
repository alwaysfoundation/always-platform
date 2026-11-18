import { serve } from '@hono/node-server';
import { connect } from '@always/db';
import { createApp } from './app.js';
import { defaultAdapters } from './adapters.js';

const sql = connect();
const app = createApp(sql, { adapters: defaultAdapters() });
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(JSON.stringify({ level: 'info', msg: 'always-api listening', port }));

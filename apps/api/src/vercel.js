import { handle } from '@hono/node-server/vercel';
import { connect } from '@always/db';
import { createApp } from './app.js';
import { defaultAdapters } from './adapters.js';
/** Vercel entry. Bundled to api/index.js at build time; functions run in Sydney (syd1). */
const sql = connect();
export default handle(createApp(sql, { adapters: defaultAdapters() }));

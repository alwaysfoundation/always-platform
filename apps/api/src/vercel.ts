import { getRequestListener } from '@hono/node-server';
import { connect } from '@always/db';
import { createApp } from './app.js';
import { defaultAdapters } from './adapters.js';

/** Vercel entry. Bundled to api/index.js at build time; functions run in Sydney (syd1). */
const sql = connect();
export default getRequestListener(createApp(sql, { adapters: defaultAdapters() }).fetch);

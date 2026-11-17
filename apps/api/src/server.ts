import { serve } from '@hono/node-server';
import { connect } from '@always/db';
import { createApp } from './app.js';
import { logAdapters } from './jobs.js';
import { resendEmail, httpSms, fetchWebhook } from './adapters.js';

const sql = connect();
const adapters = {
  email: process.env.RESEND_API_KEY ? resendEmail() : logAdapters.email,
  sms: process.env.SMS_API_URL ? httpSms() : logAdapters.sms,
  webhook: process.env.NODE_ENV === 'production' ? fetchWebhook : logAdapters.webhook,
};
const app = createApp(sql, { adapters });
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(JSON.stringify({ level: 'info', msg: 'always-api listening', port }));

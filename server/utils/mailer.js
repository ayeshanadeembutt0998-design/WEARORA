import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import EmailLog from '../models/EmailLog.js';
import { templates } from './emailTemplates/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'wearora-logo.png');
const hasLogo = () => fs.existsSync(LOGO_PATH);

let transporter;
export function getTransporter() {
  if (transporter !== undefined) return transporter;
  if (env.smtp.transport === 'json') {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  } else if (env.smtp.host && env.smtp.user && env.smtp.pass) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  } else {
    transporter = null;
  }
  return transporter;
}
export const resetTransporterForTests = () => { transporter = undefined; };

/**
 * Sends a templated email exactly once per dedupeKey.
 * NEVER throws: callers' business transactions must not fail because of email problems.
 * @returns {Promise<{status:string}>}
 */
export async function sendTemplateEmail({ dedupeKey, type, to, data = {}, attachments = [] }) {
  if (!to) return { status: 'skipped' };
  try {
    // --- claim the key (dedupe) ---
    let log;
    try {
      log = await EmailLog.create({ dedupeKey, type, to, status: 'pending', attempts: 1 });
    } catch (e) {
      if (e?.code !== 11000) throw e;
      // key exists: only retry if the previous attempt failed
      log = await EmailLog.findOneAndUpdate(
        { dedupeKey, status: 'failed' },
        { $set: { status: 'pending', error: null }, $inc: { attempts: 1 } },
        { new: true }
      );
      if (!log) return { status: 'duplicate' };
    }

    const logo = hasLogo();
    const tpl = templates[type]({ ...data, hasLogo: logo });
    const t = getTransporter();
    if (!t) {
      console.warn(`[email] SMTP not configured – "${type}" to ${to} skipped`);
      await EmailLog.updateOne({ _id: log._id }, { status: 'skipped', subject: tpl.subject });
      return { status: 'skipped' };
    }
    const mailAttachments = [...attachments];
    if (logo) mailAttachments.push({ filename: 'wearora-logo.png', path: LOGO_PATH, cid: 'wearora-logo' });
    try {
      await t.sendMail({ from: env.smtp.from, to, subject: tpl.subject, html: tpl.html, text: tpl.text, attachments: mailAttachments });
      await EmailLog.updateOne({ _id: log._id }, { status: 'sent', sentAt: new Date(), subject: tpl.subject });
      return { status: 'sent' };
    } catch (err) {
      console.error(`[email] failed "${type}" -> ${to}: ${err.message}`);
      await EmailLog.updateOne({ _id: log._id }, { status: 'failed', error: String(err.message).slice(0, 300), subject: tpl.subject });
      return { status: 'failed', error: err.message };
    }
  } catch (err) {
    console.error('[email] unexpected error:', err.message);
    return { status: 'failed', error: err.message };
  }
}

/** Fire-and-forget wrapper used inside request handlers. */
export const queueEmail = (opts) => {
  sendTemplateEmail(opts).catch((e) => console.error('[email] queue error', e.message));
};

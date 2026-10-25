/**
 * Sends email through SMTP (only when SMTP_HOST is configured).
 * Returns the REAL outcome so callers can store it honestly. Never throws.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}
export type MailResult = { ok: true } | { ok: false; error: string };

export interface Mailer {
  send(message: MailMessage): Promise<MailResult>;
}

function createSmtpMailer(): Mailer {
  const transport: Transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // 465 = TLS from the start; 587 = STARTTLS upgrade
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return {
    async send(m) {
      try {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: m.to,
          subject: m.subject,
          text: m.text,
        });
        return { ok: true };
      } catch (err) {
        // Short, safe description — no credentials or stack traces.
        const e = err as { code?: string; responseCode?: number; message?: string };
        const reason = [e.code, e.responseCode].filter(Boolean).join(' ') || 'send_failed';
        return { ok: false, error: `${reason}: ${(e.message ?? '').slice(0, 200)}` };
      }
    },
  };
}

let mailer: Mailer | null | undefined;

/** null when email is not configured (or in tests, unless a test injects one). */
export function getMailer(): Mailer | null {
  if (mailer === undefined)
    mailer = env.SMTP_HOST && env.NODE_ENV !== 'test' ? createSmtpMailer() : null;
  return mailer;
}

/** For tests: inject a mailer (or null for "not configured"); undefined resets to the default. */
export function setMailer(m: Mailer | null | undefined) {
  mailer = m;
}

/** For tests: a real SMTP mailer pointed at a given host/port (e.g. a local test SMTP server). */
export function createSmtpMailerFor(host: string, port: number): Mailer {
  const transport = nodemailer.createTransport({ host, port, secure: false, ignoreTLS: true });
  return {
    async send(m) {
      try {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: m.to,
          subject: m.subject,
          text: m.text,
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String((err as Error).message).slice(0, 200) };
      }
    },
  };
}

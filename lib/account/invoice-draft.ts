import tls from 'node:tls';
// nodemailer is already a project dependency; MailComposer ships inside it.
import MailComposer from 'nodemailer/lib/mail-composer';

// ---------------------------------------------------------------------------
// Create a Gmail draft (with the invoice PDF attached) directly in the
// jared@yourkchomes.com mailbox by APPENDing a MIME message to the Drafts
// folder over IMAP. Reuses the same Gmail app-password already used for SMTP
// invoice sending — no extra OAuth setup, no third-party IMAP library.
// ---------------------------------------------------------------------------

const IMAP_HOST = process.env.IMAP_SERVER_HOST || 'imap.gmail.com';
const IMAP_PORT = Number(process.env.IMAP_SERVER_PORT || 993);
// Same Google account/app-password the invoice SMTP sender uses.
const IMAP_USER = process.env.IMAP_SERVER_USER || process.env.EMAIL_SERVER_USER || '';
const IMAP_PASS = process.env.IMAP_SERVER_PASSWORD || process.env.EMAIL_SERVER_PASSWORD || '';
const DRAFTS_MAILBOX = process.env.IMAP_DRAFTS_MAILBOX || '[Gmail]/Drafts';
const FROM =
  process.env.EMAIL_INVOICE_FROM ||
  process.env.EMAIL_FROM ||
  'Your KC Homes LLC <jared@yourkchomes.com>';

export interface InvoiceDraftOptions {
  to?: string | null; // contact email (prefilled recipient); blank is fine
  subject: string;
  text: string;
  html?: string;
  pdf: Uint8Array | Buffer;
  pdfFileName: string;
}

/** Build the raw RFC822 message (with attachment) as a Buffer. */
async function composeMime(opts: InvoiceDraftOptions): Promise<Buffer> {
  const composer = new MailComposer({
    from: FROM,
    to: opts.to || undefined,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: [
      {
        filename: opts.pdfFileName,
        content: Buffer.from(opts.pdf),
        contentType: 'application/pdf',
      },
    ],
  });
  return new Promise<Buffer>((resolve, reject) => {
    composer.compile().build((err: Error | null, message: Buffer) => {
      if (err) reject(err);
      else resolve(message);
    });
  });
}

/** A tiny single-command IMAP client: LOGIN -> APPEND(\Draft) -> LOGOUT. */
function appendDraft(message: Buffer): Promise<void> {
  if (!IMAP_USER || !IMAP_PASS) {
    return Promise.reject(
      new Error('IMAP credentials missing (set EMAIL_SERVER_USER / EMAIL_SERVER_PASSWORD).'),
    );
  }

  return new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host: IMAP_HOST, port: IMAP_PORT, servername: IMAP_HOST });

    let buf = '';
    let stage: 'greeting' | 'login' | 'append-literal' | 'append-body' | 'logout' = 'greeting';
    let settled = false;

    const fail = (e: Error) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      reject(e);
    };

    const done = () => {
      if (settled) return;
      settled = true;
      try {
        socket.end();
      } catch {
        /* ignore */
      }
      resolve();
    };

    const timer = setTimeout(() => fail(new Error('IMAP timeout')), 20_000);
    socket.setEncoding('utf8');
    socket.on('error', (e) => {
      clearTimeout(timer);
      fail(e instanceof Error ? e : new Error(String(e)));
    });

    const send = (line: string) => socket.write(line + '\r\n');

    const quoteLiteral = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    socket.on('data', (chunk: string) => {
      buf += chunk;

      if (stage === 'greeting') {
        if (/^\* (OK|PREAUTH)/m.test(buf)) {
          buf = '';
          stage = 'login';
          send(`a1 LOGIN "${quoteLiteral(IMAP_USER)}" "${quoteLiteral(IMAP_PASS)}"`);
        } else if (/^\* BYE/m.test(buf)) {
          fail(new Error('IMAP server refused connection'));
        }
        return;
      }

      if (stage === 'login') {
        if (/^a1 OK/mi.test(buf)) {
          buf = '';
          stage = 'append-literal';
          // {N} = exact octet length of the literal that follows.
          send(`a2 APPEND "${quoteLiteral(DRAFTS_MAILBOX)}" (\\Draft) {${message.length}}`);
        } else if (/^a1 (NO|BAD)/mi.test(buf)) {
          fail(new Error(`IMAP login failed: ${buf.trim()}`));
        }
        return;
      }

      if (stage === 'append-literal') {
        // Server sends a "+" continuation request, then we stream the body.
        if (/^\+/m.test(buf)) {
          buf = '';
          stage = 'append-body';
          socket.write(message);
          socket.write('\r\n');
        } else if (/^a2 (NO|BAD)/mi.test(buf)) {
          fail(new Error(`IMAP APPEND rejected: ${buf.trim()}`));
        }
        return;
      }

      if (stage === 'append-body') {
        if (/^a2 OK/mi.test(buf)) {
          buf = '';
          stage = 'logout';
          send('a3 LOGOUT');
          // Don't wait on logout — resolve as soon as the draft is saved.
          clearTimeout(timer);
          done();
        } else if (/^a2 (NO|BAD)/mi.test(buf)) {
          fail(new Error(`IMAP APPEND failed: ${buf.trim()}`));
        }
        return;
      }
    });
  });
}

/** Compose the invoice email + PDF and save it as a Gmail draft. */
export async function createInvoiceDraft(opts: InvoiceDraftOptions): Promise<void> {
  const message = await composeMime(opts);
  await appendDraft(message);
}

export const invoiceDraftMailbox = DRAFTS_MAILBOX;
export const invoiceDraftAccount = IMAP_USER;

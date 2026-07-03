declare module "nodemailer";

declare module "nodemailer/lib/mail-composer" {
  import { Readable } from "node:stream";

  interface MailComposerAttachment {
    filename?: string;
    content?: Buffer | string | Readable;
    path?: string;
    contentType?: string;
    cid?: string;
    encoding?: string;
  }

  interface MailComposerOptions {
    from?: string;
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    subject?: string;
    text?: string;
    html?: string;
    attachments?: MailComposerAttachment[];
    headers?: Record<string, string>;
  }

  interface CompiledMail {
    build(callback: (err: Error | null, message: Buffer) => void): void;
  }

  class MailComposer {
    constructor(options: MailComposerOptions);
    compile(): CompiledMail;
  }

  export default MailComposer;
}

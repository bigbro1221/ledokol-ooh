import { ServerClient } from 'postmark';
import { isSuppressed, SuppressedEmailError } from '@/lib/suppression';

export { SuppressedEmailError };

let client: ServerClient | null = null;

function getClient(): ServerClient {
  if (client) return client;
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) throw new Error('POSTMARK_SERVER_TOKEN env var is not set');
  client = new ServerClient(token);
  return client;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: Array<{ Name: string; Value: string }>;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ messageId: string }> {
  if (await isSuppressed(opts.to)) {
    throw new SuppressedEmailError(opts.to);
  }

  const from = process.env.POSTMARK_FROM_ADDRESS ?? process.env.MAIL_FROM_ADDRESS;
  if (!from) throw new Error('POSTMARK_FROM_ADDRESS env var is not set');

  const stream = process.env.POSTMARK_MESSAGE_STREAM || 'outbound';

  try {
    const result = await getClient().sendEmail({
      From: from,
      To: opts.to,
      Subject: opts.subject,
      HtmlBody: opts.html,
      TextBody: opts.text,
      MessageStream: stream,
      ...(opts.replyTo ? { ReplyTo: opts.replyTo } : {}),
      ...(opts.tags?.length ? { Tag: opts.tags[0].Value } : {}),
    });
    return { messageId: result.MessageID };
  } catch (err) {
    console.error('[mail] Postmark send failed', {
      to: opts.to,
      subject: opts.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

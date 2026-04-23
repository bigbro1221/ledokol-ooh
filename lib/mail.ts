import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { isSuppressed, SuppressedEmailError } from '@/lib/suppression';

export { SuppressedEmailError };

const ses = new SESClient({
  region: process.env.AWS_REGION ?? 'eu-central-1',
  ...(process.env.AWS_ACCESS_KEY_ID
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }
    : {}),
});

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

  const from = process.env.SES_FROM_ADDRESS;
  if (!from) throw new Error('SES_FROM_ADDRESS env var is not set');

  try {
    const cmd = new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [opts.to] },
      Message: {
        Subject: { Data: opts.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: opts.html, Charset: 'UTF-8' },
          Text: { Data: opts.text, Charset: 'UTF-8' },
        },
      },
      ...(opts.replyTo ? { ReplyToAddresses: [opts.replyTo] } : {}),
      ...(opts.tags?.length ? { Tags: opts.tags } : {}),
    });

    const result = await ses.send(cmd);
    return { messageId: result.MessageId! };
  } catch (err) {
    console.error('[mail] SES send failed', {
      to: opts.to,
      subject: opts.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

import { NextResponse } from 'next/server';
import MessageValidator from 'sns-validator';
import { suppress, recordSoftBounce } from '@/lib/suppression';

const validator = new MessageValidator();

function validateSignature(body: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    validator.validate(body, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function POST(request: Request) {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Validate SNS message signature (skipped in dev for local testing)
  if (process.env.NODE_ENV === 'production') {
    try {
      await validateSignature(body);
    } catch (err) {
      console.error('[ses-webhook] signature validation failed', err);
      return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
    }
  }

  // Optionally assert the expected topic ARN
  const expectedTopic = process.env.SES_SNS_TOPIC_ARN;
  if (expectedTopic && body.TopicArn && body.TopicArn !== expectedTopic) {
    console.warn('[ses-webhook] unexpected TopicArn', body.TopicArn);
    return NextResponse.json({ error: 'unexpected topic' }, { status: 400 });
  }

  // Auto-confirm SNS subscription
  if (body.Type === 'SubscriptionConfirmation') {
    try {
      await fetch(body.SubscribeURL);
      console.log('[ses-webhook] SNS subscription confirmed', body.TopicArn);
    } catch (err) {
      console.error('[ses-webhook] subscription confirmation failed', err);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.Type !== 'Notification') {
    return NextResponse.json({ ok: true });
  }

  let notification: Record<string, unknown>;
  try {
    notification = JSON.parse(body.Message);
  } catch {
    console.warn('[ses-webhook] could not parse Notification Message');
    return NextResponse.json({ ok: true });
  }

  const notifType = notification.notificationType as string;
  const rawPayload = body.Message;

  if (notifType === 'Bounce') {
    const bounce = notification.bounce as Record<string, unknown>;
    const bounceType = bounce?.bounceType as string;
    const bounceSubType = bounce?.bounceSubType as string;
    const recipients = (bounce?.bouncedRecipients as Array<{ emailAddress: string }>) ?? [];
    const eventType = `Bounce:${bounceType}:${bounceSubType}`;

    for (const { emailAddress } of recipients) {
      if (bounceType === 'Permanent') {
        console.log('[ses-webhook] hard bounce', emailAddress, eventType);
        await suppress({ email: emailAddress, reason: 'HARD_BOUNCE', eventType, rawPayload });
      } else {
        console.log('[ses-webhook] soft bounce', emailAddress, eventType);
        await recordSoftBounce(emailAddress, eventType, rawPayload);
      }
    }
  } else if (notifType === 'Complaint') {
    const complaint = notification.complaint as Record<string, unknown>;
    const recipients = (complaint?.complainedRecipients as Array<{ emailAddress: string }>) ?? [];
    for (const { emailAddress } of recipients) {
      console.log('[ses-webhook] complaint', emailAddress);
      await suppress({ email: emailAddress, reason: 'COMPLAINT', eventType: 'Complaint', rawPayload });
    }
  } else {
    console.log('[ses-webhook] unhandled notification type', notifType);
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { suppress, recordSoftBounce } from '@/lib/suppression';

// Postmark bounce "Type" strings that we treat as permanent (hard) suppressions.
// Full list: https://postmarkapp.com/developer/api/bounce-api#bounce-types
const HARD_BOUNCE_TYPES = new Set<string>([
  'HardBounce',
  'BadEmailAddress',
  'ManuallyDeactivated',
  'Blocked',
  'BlockedISP',
  'DnsError',
  'DMARCPolicy',
  'Unknown',
]);

// Treat as transient (soft) — retryable.
const SOFT_BOUNCE_TYPES = new Set<string>([
  'Transient',
  'SoftBounce',
  'SMTPApiError',
]);

function checkBasicAuth(request: Request): boolean {
  const user = process.env.POSTMARK_WEBHOOK_USER;
  const pass = process.env.POSTMARK_WEBHOOK_PASSWORD;
  if (!user || !pass) return process.env.NODE_ENV !== 'production';

  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return false;

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx < 0) return false;
    return decoded.slice(0, idx) === user && decoded.slice(idx + 1) === pass;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!checkBasicAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const recordType = payload.RecordType as string | undefined;
  const email = (payload.Email as string | undefined)?.toLowerCase();
  const rawPayload = JSON.stringify(payload);

  if (!email) {
    return NextResponse.json({ ok: true });
  }

  if (recordType === 'Bounce') {
    const bounceType = payload.Type as string | undefined;
    const eventType = `Bounce:${bounceType ?? 'Unknown'}`;

    if (bounceType && HARD_BOUNCE_TYPES.has(bounceType)) {
      console.log('[postmark-webhook] hard bounce', email, eventType);
      await suppress({ email, reason: 'HARD_BOUNCE', eventType, rawPayload });
    } else if (bounceType && SOFT_BOUNCE_TYPES.has(bounceType)) {
      console.log('[postmark-webhook] soft bounce', email, eventType);
      await recordSoftBounce(email, eventType, rawPayload);
    } else {
      console.log('[postmark-webhook] unhandled bounce type', email, bounceType);
    }
  } else if (recordType === 'SpamComplaint') {
    console.log('[postmark-webhook] complaint', email);
    await suppress({
      email,
      reason: 'COMPLAINT',
      eventType: 'SpamComplaint',
      rawPayload,
    });
  } else {
    console.log('[postmark-webhook] unhandled record type', recordType);
  }

  return NextResponse.json({ ok: true });
}

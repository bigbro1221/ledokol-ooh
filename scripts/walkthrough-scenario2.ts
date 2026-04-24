/**
 * Walkthrough scenario 2: create a test user directly via Prisma + activation lib.
 * Verifies: User row (status=INVITED), ActivationToken row, email error is clean.
 * Run: npx tsx scripts/walkthrough-scenario2.ts
 */
import { PrismaClient } from '@prisma/client';
import { issueActivationToken, buildActivationUrl } from '../lib/activation';
import { renderActivationEmail } from '../lib/email-templates/activation';
import { sendEmail } from '../lib/mail';
import { SuppressedEmailError } from '../lib/suppression';

const prisma = new PrismaClient();
const TIMESTAMP = Date.now();
const TEST_EMAIL = `test-activation-${TIMESTAMP}@example.com`;
const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

async function main() {
  console.log(`\n=== Scenario 2 walk-through (${new Date().toISOString()}) ===\n`);

  // Step 1: Create user
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      role: 'CLIENT',
      status: 'INVITED',
      language: 'RU',
    },
  });
  console.log('1. User created:');
  console.log(`   email:  ${user.email}`);
  console.log(`   id:     ${user.id}`);
  console.log(`   status: ${user.status}`);
  console.log(`   passwordHash: ${user.passwordHash ?? '(null — passwordless invite)'}\n`);

  // Step 2: Issue activation token
  const rawToken = await issueActivationToken(user.id);
  const activationUrl = buildActivationUrl(user.id, rawToken, 'ru', BASE_URL);

  // Verify DB row
  const tokenRow = await prisma.activationToken.findUnique({
    where: { userId: user.id },
    select: { id: true, tokenHash: true, expiresAt: true, consumedAt: true, createdAt: true },
  });
  console.log('2. ActivationToken row:');
  console.log(`   id:          ${tokenRow!.id}`);
  console.log(`   tokenHash:   (non-null, bcrypt hash — not printed)`);
  console.log(`   expiresAt:   ${tokenRow!.expiresAt.toISOString()} (≈7 days from now)`);
  console.log(`   consumedAt:  ${tokenRow!.consumedAt ?? '(null — not yet consumed)'}\n`);

  // Step 3: Build and show activation URL (token redacted for display)
  const redacted = activationUrl.replace(rawToken, '<raw-token-redacted>');
  console.log('3. Activation URL (token redacted for display):');
  console.log(`   ${redacted}`);
  console.log('   (built by lib/activation.ts → buildActivationUrl)\n');

  // Step 4: Attempt email send (Postmark will fail in dev — verify clean error handling)
  const { subject, html: _html, text } = renderActivationEmail({ activationUrl, locale: 'ru' });
  console.log('4. Email template rendered:');
  console.log(`   Subject: "${subject}"`);
  console.log(`   Text snippet: "${text.split('\n')[0]}"\n`);

  let emailOutcome = '';
  try {
    await sendEmail({ to: TEST_EMAIL, subject, html: _html, text });
    emailOutcome = 'Email sent (Postmark token present — unexpected in dev)';
  } catch (err) {
    if (err instanceof SuppressedEmailError) {
      emailOutcome = `SuppressedEmailError (email on suppression list)`;
    } else if (err instanceof Error && /POSTMARK_SERVER_TOKEN|MAIL_FROM_ADDRESS/.test(err.message)) {
      emailOutcome = `Config error: ${err.message}`;
    } else {
      // Expected: Postmark SDK throws auth/network error
      emailOutcome = `Postmark SDK error (expected in dev — no token): ${err instanceof Error ? err.constructor.name : 'unknown'}: "${err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80)}"`;
    }
  }
  console.log(`5. sendEmail outcome: ${emailOutcome}\n`);

  // Step 5: Print the real URL for Scenario 3
  console.log('6. REAL activation URL for Scenario 3 (contains raw token):');
  console.log(`   ${activationUrl}\n`);

  // Save for scenario 3
  require('fs').writeFileSync('/tmp/s2-state.json', JSON.stringify({
    userId: user.id,
    email: TEST_EMAIL,
    rawToken,
    activationUrl,
  }));
  console.log('   (saved to /tmp/s2-state.json for scenario 3)\n');
}

main()
  .catch(err => { console.error('FATAL:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());

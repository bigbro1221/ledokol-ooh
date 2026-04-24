import { config } from 'dotenv';
config();

import { sendEmail } from '@/lib/mail';
import { renderLoginCodeEmail } from '@/lib/email-templates/login-code';

async function main() {
  const to = process.argv[2] ?? process.env.POSTMARK_TEST_RECIPIENT;
  if (!to) {
    console.error('Usage: npx tsx scripts/test-postmark.ts <recipient@example.com>');
    process.exit(1);
  }

  console.log(`Sending test email to ${to}...`);
  console.log(`  token:     ${process.env.POSTMARK_SERVER_TOKEN ? 'set (' + process.env.POSTMARK_SERVER_TOKEN.slice(0, 6) + '…)' : 'MISSING'}`);
  console.log(`  from:      ${process.env.POSTMARK_FROM_ADDRESS ?? process.env.MAIL_FROM_ADDRESS ?? 'MISSING'}`);
  console.log(`  stream:    ${process.env.POSTMARK_MESSAGE_STREAM ?? 'outbound (default)'}`);

  const { subject, html, text } = renderLoginCodeEmail({ code: '123456', locale: 'ru' });

  try {
    const result = await sendEmail({ to, subject, html, text });
    console.log(`\n✅ Sent. MessageID: ${result.messageId}`);
    console.log('   Check Postmark → Activity to confirm.');
  } catch (err) {
    console.error('\n❌ Send failed:');
    console.error(err instanceof Error ? `${err.constructor.name}: ${err.message}` : err);
    process.exit(1);
  }
}

main();

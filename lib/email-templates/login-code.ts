type Locale = 'ru' | 'en' | 'uz';

const copy: Record<Locale, {
  subject: string;
  heading: string;
  body: string;
  expiry: string;
  ignore: string;
  footer: string;
}> = {
  en: {
    subject: 'Your Ledokol login code',
    heading: 'Your login code',
    body: 'Use this code to sign in to Ledokol OOH Dashboard. It expires in 10 minutes.',
    expiry: 'Expires in 10 minutes',
    ignore: "If you didn't request this code, you can safely ignore this email.",
    footer: 'Ledokol Group — outdoor advertising',
  },
  ru: {
    subject: 'Ваш код входа в Ledokol',
    heading: 'Код для входа',
    body: 'Используйте этот код для входа в Ledokol OOH Dashboard. Код действителен 10 минут.',
    expiry: 'Действителен 10 минут',
    ignore: 'Если вы не запрашивали этот код, просто проигнорируйте это письмо.',
    footer: 'Ledokol Group — наружная реклама',
  },
  uz: {
    subject: 'Ledokol kirish kodingiz',
    heading: 'Kirish kodi',
    body: "Ledokol OOH Dashboard'ga kirish uchun ushbu kodni ishlating. Kod 10 daqiqa davomida amal qiladi.",
    expiry: '10 daqiqa amal qiladi',
    ignore: "Agar siz bu kodni so'ramagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.",
    footer: "Ledokol Group — tashqi reklama",
  },
};

export function renderLoginCodeEmail({
  code,
  locale,
}: {
  code: string;
  locale: Locale;
}): { subject: string; html: string; text: string } {
  const c = copy[locale];

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${c.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0C5DC6;padding:28px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.02em;">Ledokol<span style="opacity:0.7;">.</span></span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827;">${c.heading}</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">${c.body}</p>
              <!-- Code box -->
              <div style="background:#f0f5ff;border:1px solid #c7d9f9;border-radius:8px;padding:24px;text-align:center;margin-bottom:28px;">
                <span style="font-size:40px;font-weight:700;letter-spacing:0.15em;color:#0C5DC6;font-variant-numeric:tabular-nums;">${code}</span>
                <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">${c.expiry}</p>
              </div>
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">${c.ignore}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <span style="font-size:12px;color:#9ca3af;">${c.footer}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${c.heading}

${c.body}

${code}

${c.expiry}

${c.ignore}

${c.footer}`;

  return { subject: c.subject, html, text };
}

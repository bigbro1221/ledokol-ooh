type Locale = 'ru' | 'en' | 'uz';

const copy: Record<Locale, {
  subject: string;
  heading: string;
  greeting: (name?: string) => string;
  body: string;
  cta: string;
  expiry: string;
  security: string;
  footer: string;
}> = {
  en: {
    subject: 'Activate your Ledokol Group account',
    heading: 'Activate your account',
    greeting: (name) => name ? `Hello, ${name}!` : 'Hello!',
    body: 'An admin has created a Ledokol OOH Dashboard account for you. Click the button below to activate it by linking your Google account.',
    cta: 'Activate account',
    expiry: 'This link expires in 7 days.',
    security: "If you didn't expect this invitation, you can safely ignore this email.",
    footer: 'Ledokol Group — outdoor advertising',
  },
  ru: {
    subject: 'Активация аккаунта — Ledokol Group',
    heading: 'Активируйте ваш аккаунт',
    greeting: (name) => name ? `Здравствуйте, ${name}!` : 'Здравствуйте!',
    body: 'Администратор создал для вас аккаунт в Ledokol OOH Dashboard. Нажмите кнопку ниже, чтобы активировать его, привязав Google аккаунт.',
    cta: 'Активировать аккаунт',
    expiry: 'Ссылка действует 7 дней.',
    security: 'Если вы не ожидали это приглашение, просто проигнорируйте письмо.',
    footer: 'Ledokol Group — наружная реклама',
  },
  uz: {
    subject: 'Hisobingizni faollashtiring — Ledokol Group',
    heading: 'Hisobingizni faollashtiring',
    greeting: (name) => name ? `Salom, ${name}!` : 'Salom!',
    body: "Administrator Ledokol OOH Dashboard'da siz uchun hisob yaratdi. Uni faollashtirish uchun quyidagi tugmani bosing va Google hisobingizni bog'lang.",
    cta: 'Hisobni faollashtirish',
    expiry: 'Havola 7 kun davomida amal qiladi.',
    security: "Agar siz bu taklifni kutmagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.",
    footer: "Ledokol Group — tashqi reklama",
  },
};

export function renderActivationEmail({
  activationUrl,
  userName,
  locale,
}: {
  activationUrl: string;
  userName?: string;
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
          <tr>
            <td style="background:#0C5DC6;padding:28px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.02em;">Ledokol<span style="opacity:0.7;">.</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">${c.heading}</h1>
              <p style="margin:0 0 8px;font-size:14px;color:#374151;">${c.greeting(userName)}</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">${c.body}</p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#0C5DC6;border-radius:8px;">
                    <a href="${activationUrl}"
                       target="_blank"
                       rel="noopener noreferrer"
                       style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">
                      ${c.cta}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">${c.expiry}</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">${c.security}</p>
            </td>
          </tr>
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

${c.greeting(userName)}

${c.body}

${c.cta}:
${activationUrl}

${c.expiry}

${c.security}

${c.footer}`;

  return { subject: c.subject, html, text };
}

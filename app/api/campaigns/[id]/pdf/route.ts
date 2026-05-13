import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { renderCampaignPdf } from '@/lib/pdf/render';
import { slugForFilename } from '@/lib/pdf/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { id: campaignId } = await params;

  const clientFilter =
    session.user.role === 'CLIENT' && session.user.clientId
      ? { client: { users: { some: { id: session.user.id } } } }
      : {};
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...clientFilter },
    select: { id: true, name: true, periodStart: true, periodEnd: true, client: { select: { name: true } } },
  });
  if (!campaign) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const cookieName = req.cookies.get('__Secure-authjs.session-token')
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
  const cookieValue = req.cookies.get(cookieName)?.value;
  if (!cookieValue) {
    return NextResponse.json({ error: 'no_session_cookie' }, { status: 401 });
  }

  const referer = req.headers.get('referer') || '';
  const localeMatch = referer.match(/\/(ru|en|uz)\//);
  const locale = (localeMatch?.[1] ?? 'ru') as 'ru' | 'en' | 'uz';

  const printUrl = `http://localhost:3000/${locale}/print/campaign/${campaignId}`;

  const periodFmt = `${campaign.periodStart.toLocaleDateString(localeForFormat(locale))} — ${campaign.periodEnd.toLocaleDateString(localeForFormat(locale))}`;
  const generatedAtFmt = new Date().toLocaleDateString(localeForFormat(locale));

  try {
    const buffer = await renderCampaignPdf({
      url: printUrl,
      sessionCookie: { name: cookieName, value: cookieValue },
      cookieDomain: 'localhost',
      locale,
      headerLeft: `${campaign.name} · ${campaign.client.name}`,
      headerRight: periodFmt,
      footerLeft: generatedAtFmt,
    });

    const filename = [
      slugForFilename(campaign.client.name),
      slugForFilename(campaign.name),
      new Date().toISOString().slice(0, 10),
    ].filter(Boolean).join('-') + '.pdf';

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /timeout|TimeoutError/i.test(message) ? 504 : 500;
    console.error('[pdf] render failed:', { campaignId, message });
    return NextResponse.json(
      { error: status === 504 ? 'pdf_render_timeout' : 'pdf_render_failed' },
      { status },
    );
  }
}

function localeForFormat(l: 'ru' | 'en' | 'uz'): string {
  return l === 'en' ? 'en-US' : l === 'uz' ? 'uz-UZ' : 'ru-RU';
}

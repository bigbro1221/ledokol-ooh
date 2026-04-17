import { NextResponse } from 'next/server';
import { parseMediaPlan } from '@/lib/parser';
import { uploadFile } from '@/lib/minio';
import { fetchYandexPins } from '@/lib/parser/yandex';
import { matchPinsToRows, getTopSuggestions } from '@/lib/parser/matcher';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const campaignId = formData.get('campaignId') as string | null;
  const periodId = formData.get('periodId') as string | null;

  if (!file || !campaignId) {
    return NextResponse.json({ error: 'File and campaignId are required' }, { status: 400 });
  }

  // Size limit: 50MB
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 50MB.' },
      { status: 413 }
    );
  }

  // MIME type validation
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream', // some browsers send this for .xlsx
  ];
  if (file.type && !allowedMimeTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Only .xlsx files are accepted.' },
      { status: 400 }
    );
  }

  // Extension validation (belt and suspenders)
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
    return NextResponse.json(
      { error: 'Invalid file extension. Only .xlsx files are accepted.' },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Store original in MinIO
  const key = `campaigns/${campaignId}/${Date.now()}-${file.name}`;
  try {
    await uploadFile(key, buffer, file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (err) {
    console.error('MinIO upload failed (non-fatal):', err);
  }

  // Parse XLSX
  const result = parseMediaPlan(buffer);

  // Resolve Yandex map URL: prefer value parsed from XLSX, fall back to campaign DB record
  if (!result.campaign.yandexMapUrl) {
    const dbCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { yandexMapUrl: true },
    });
    if (dbCampaign?.yandexMapUrl) {
      result.campaign.yandexMapUrl = dbCampaign.yandexMapUrl;
    }
  }

  // Fetch Yandex pins and match if URL present
  let unmatchedPins: { lat: number; lng: number; city: string; label: string }[] = [];
  let allPins: { lat: number; lng: number; city: string; label: string }[] = [];
  let matchedCount = 0;

  // Per-screen geocoding info: index → { matched: bool, suggestions: top-5 pins }
  type PinSuggestion = { lat: number; lng: number; label: string; score: number };
  const screenGeo: { matched: boolean; suggestions: PinSuggestion[] }[] = result.screens.map(() => ({
    matched: false,
    suggestions: [],
  }));

  if (result.campaign.yandexMapUrl) {
    allPins = await fetchYandexPins(result.campaign.yandexMapUrl);
    const addresses = result.screens.map(s => s.address);
    const { matched, unmatched } = matchPinsToRows(allPins, addresses);
    unmatchedPins = unmatched;
    matchedCount = matched.size;

    for (let i = 0; i < result.screens.length; i++) {
      const screen = result.screens[i];
      const coords = matched.get(screen.address);
      if (coords) {
        (screen as Record<string, unknown>).lat = coords.lat;
        (screen as Record<string, unknown>).lng = coords.lng;
        screenGeo[i].matched = true;
      } else {
        // Provide top suggestions from all available pins (not just unmatched)
        screenGeo[i].suggestions = getTopSuggestions(screen.address, allPins, 5).map(p => ({
          lat: p.lat,
          lng: p.lng,
          label: p.label,
          score: Math.round(p.score * 100),
        }));
      }
    }
  }

  return NextResponse.json({
    campaignId,
    periodId: periodId || null,
    minioKey: key,
    campaign: result.campaign,
    screens: result.screens,
    screenGeo,
    errors: result.errors,
    warnings: result.warnings,
    geocoding: {
      matchedCount,
      unmatchedPins,
      totalPins: matchedCount + unmatchedPins.length,
    },
    summary: {
      totalScreens: result.screens.length,
      byType: result.screens.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  });
}

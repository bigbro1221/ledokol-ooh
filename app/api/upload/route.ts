import { NextResponse } from 'next/server';
import { parseMediaPlan } from '@/lib/parser';
import { parseMultiPeriod } from '@/lib/parser/multi-period';
import { uploadFile } from '@/lib/minio';
import { fetchYandexPins } from '@/lib/parser/yandex';
import { matchPinsToRows, getTopSuggestions } from '@/lib/parser/matcher';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

import type { MediaType } from '@prisma/client';

type CampaignContext = {
  id: string;
  mediaType: MediaType;
  yandexMapUrl: string | null;
};

type Pin = { lat: number; lng: number; city: string; label: string };
type PinSuggestion = { lat: number; lng: number; label: string; score: number };
type Geocoded<T> = T & { lat?: number; lng?: number };

/**
 * Geocode a list of screens against a Yandex map URL. Mutates input array
 * with lat/lng for matches; returns parallel screenGeo metadata. When the
 * URL is empty/null, returns empty geocoding result.
 */
async function geocodeScreens<T extends { address: string }>(
  screens: T[],
  yandexMapUrl: string | null,
): Promise<{
  screens: Geocoded<T>[];
  screenGeo: { matched: boolean; suggestions: PinSuggestion[] }[];
  matchedCount: number;
  unmatchedPins: Pin[];
}> {
  const screenGeo: { matched: boolean; suggestions: PinSuggestion[] }[] = screens.map(() => ({
    matched: false,
    suggestions: [],
  }));
  if (!yandexMapUrl) {
    return { screens: screens as Geocoded<T>[], screenGeo, matchedCount: 0, unmatchedPins: [] };
  }

  const allPins = await fetchYandexPins(yandexMapUrl);
  const { matched, unmatched } = matchPinsToRows(allPins, screens.map(s => s.address));
  const out = screens as Geocoded<T>[];

  for (let i = 0; i < out.length; i++) {
    const coords = matched.get(out[i].address);
    if (coords) {
      out[i].lat = coords.lat;
      out[i].lng = coords.lng;
      screenGeo[i].matched = true;
    } else {
      screenGeo[i].suggestions = getTopSuggestions(out[i].address, allPins, 5).map(p => ({
        lat: p.lat,
        lng: p.lng,
        label: p.label,
        score: Math.round(p.score * 100),
      }));
    }
  }
  return { screens: out, screenGeo, matchedCount: matched.size, unmatchedPins: unmatched };
}

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

  // Look up the campaign up front — its mediaType drives parser dispatch.
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, mediaType: true, yandexMapUrl: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Store original in MinIO
  const key = `campaigns/${campaignId}/${Date.now()}-${file.name}`;
  try {
    await uploadFile(key, buffer, file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (err) {
    console.error('MinIO upload failed (non-fatal):', err);
  }

  if (campaign.mediaType === 'OTHER_CARRIERS') {
    return handleMultiPeriod(buffer, campaign, key);
  }
  return handleScreensMode(buffer, campaign, key, periodId);
}

async function handleScreensMode(
  buffer: Buffer,
  campaign: CampaignContext,
  minioKey: string,
  periodId: string | null,
): Promise<NextResponse> {
  // Parse XLSX
  const result = parseMediaPlan(buffer);

  // Resolve Yandex map URL: prefer value parsed from XLSX, fall back to campaign DB record
  if (!result.campaign.yandexMapUrl && campaign.yandexMapUrl) {
    result.campaign.yandexMapUrl = campaign.yandexMapUrl;
  }

  const { screenGeo, matchedCount, unmatchedPins } = await geocodeScreens(
    result.screens,
    result.campaign.yandexMapUrl,
  );

  return NextResponse.json({
    mode: 'screens' as const,
    campaignId: campaign.id,
    periodId: periodId || null,
    minioKey,
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
        acc[s.typeCode] = (acc[s.typeCode] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  });
}

async function handleMultiPeriod(
  buffer: Buffer,
  campaign: CampaignContext,
  minioKey: string,
  // periodId is intentionally ignored — periods come from the file in this mode.
): Promise<NextResponse> {
  const result = parseMultiPeriod(buffer);

  // Group rows by physical screen: (city|address|typeCode) → first occurrence.
  type ScreenObj = (typeof result.rows)[number]['screen'];
  const screenKey = (s: ScreenObj) => `${s.city}|${s.address}|${s.typeCode}`;
  const screenMap = new Map<string, ScreenObj>();
  for (const row of result.rows) {
    const k = screenKey(row.screen);
    if (!screenMap.has(k)) screenMap.set(k, row.screen);
  }
  const screens = Array.from(screenMap.values());

  // Dedupe periods by start/end pair, sorted ascending.
  const periodsMap = new Map<string, { start: string; end: string; label: string }>();
  for (const row of result.rows) {
    const k = `${row.periodStart.toISOString()}_${row.periodEnd.toISOString()}`;
    if (!periodsMap.has(k)) {
      periodsMap.set(k, {
        start: row.periodStart.toISOString(),
        end: row.periodEnd.toISOString(),
        label: row.periodLabel,
      });
    }
  }
  const periods = Array.from(periodsMap.values()).sort((a, b) => (a.start < b.start ? -1 : 1));

  // Yandex map: this template doesn't surface a URL, so fall back to the campaign's saved value.
  const yandexMapUrl = campaign.yandexMapUrl;
  const { screenGeo, matchedCount, unmatchedPins } = await geocodeScreens(screens, yandexMapUrl);

  // Serialize rows: Date → ISO string. Inner `screen` is included verbatim (already JSON-safe).
  const rowsSerialized = result.rows.map(r => ({
    screen: r.screen,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    periodLabel: r.periodLabel,
  }));

  return NextResponse.json({
    mode: 'multi-period' as const,
    campaignId: campaign.id,
    minioKey,
    campaign: { ...result.campaign, yandexMapUrl },
    screens,
    screenGeo,
    rows: rowsSerialized,
    periods,
    errors: result.errors,
    warnings: result.warnings,
    geocoding: {
      matchedCount,
      unmatchedPins,
      totalPins: matchedCount + unmatchedPins.length,
    },
    summary: {
      totalScreens: screens.length,
      totalRows: result.rows.length,
      totalPeriods: periods.length,
      byType: screens.reduce((acc, s) => {
        acc[s.typeCode] = (acc[s.typeCode] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  });
}

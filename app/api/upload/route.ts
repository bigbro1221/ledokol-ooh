import { NextResponse } from 'next/server';
import { parseMediaPlan } from '@/lib/parser';
import { uploadFile } from '@/lib/minio';
import { fetchYandexPins } from '@/lib/parser/yandex';
import { matchPinsToRows } from '@/lib/parser/matcher';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const campaignId = formData.get('campaignId') as string | null;

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

  // Fetch Yandex pins and match if URL present
  let unmatchedPins: { lat: number; lng: number; city: string; label: string }[] = [];
  let matchedCount = 0;

  if (result.campaign.yandexMapUrl) {
    const pins = await fetchYandexPins(result.campaign.yandexMapUrl);
    const addresses = result.screens.map(s => s.address);
    const { matched, unmatched } = matchPinsToRows(pins, addresses);
    unmatchedPins = unmatched;
    matchedCount = matched.size;

    for (const screen of result.screens) {
      const coords = matched.get(screen.address);
      if (coords) {
        (screen as Record<string, unknown>).lat = coords.lat;
        (screen as Record<string, unknown>).lng = coords.lng;
      }
    }
  }

  return NextResponse.json({
    campaignId,
    minioKey: key,
    campaign: result.campaign,
    screens: result.screens,
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

import type { YandexPin } from './matcher';

export function extractConstructorId(mapUrl: string): string | null {
  // URL-encoded: um=constructor%3A{ID}
  const encoded = mapUrl.match(/um=constructor%3A([a-f0-9]+)/i);
  if (encoded) return encoded[1];
  // URL-decoded: um=constructor:{ID}
  const decoded = mapUrl.match(/um=constructor:([a-f0-9]+)/i);
  return decoded?.[1] || null;
}

export async function fetchYandexPins(mapUrl: string): Promise<YandexPin[]> {
  const constructorId = extractConstructorId(mapUrl);
  if (!constructorId) return [];

  // Yandex changed their API — GeoJSON is now embedded in the widget HTML page
  const widgetUrl = `https://yandex.ru/map-widget/v1/?lang=ru_RU&scroll=false&source=constructor-api&um=constructor%3A${constructorId}`;

  try {
    const response = await fetch(widgetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const html = await response.text();

    // Extract placemarks from embedded JSON data in the widget page
    // Format: "title":"...","subtitle":"...","isTextInTitle":...,"zIndex":...,"type":"placemark","coordinates":[lng,lat]
    const placemarkRegex = /"title":"([^"]*)","subtitle":"([^"]*)","isTextInTitle":[^,]+,"zIndex":\d+,"type":"placemark","coordinates":\[([0-9.]+),([0-9.]+)\]/g;

    const pins: YandexPin[] = [];
    let match;
    while ((match = placemarkRegex.exec(html)) !== null) {
      const title = match[1].replace(/\\n/g, ' ').trim();
      const subtitle = match[2].replace(/\\n/g, ' ').trim();
      const lng = parseFloat(match[3]);
      const lat = parseFloat(match[4]);

      // In the widget data, "title" can be the city name and "subtitle" the address,
      // or "title" can be the address. Use the longer one as label for matching.
      const label = subtitle.length > title.length ? subtitle : title;
      const city = subtitle.length > title.length ? title : subtitle;

      pins.push({ lat, lng, city, label });
    }

    console.log(`Yandex: fetched ${pins.length} placemarks from widget`);
    return pins;
  } catch (err) {
    console.error('Failed to fetch Yandex pins:', err);
    return [];
  }
}

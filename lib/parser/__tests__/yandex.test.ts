import assert from 'node:assert/strict';
import { parsePlacemarksFromHtml } from '../yandex';

// Minimal HTML snippet shaped like a Yandex widget: pin titles wrapped in JSON
// with embedded escaped quotes. Pre-fix, the [^"]* capture truncated at the
// first \" and skipped this placemark entirely.
const htmlWithEscapedQuotes = String.raw`
  ...{"title":"М.Улугбека\" и \"Паркентский\" Шастри 2","subtitle":"","isTextInTitle":true,"zIndex":3047,"type":"placemark","coordinates":[69.31676828619935,41.31699422301943],"stroke":...
  ...{"title":"Простой адрес","subtitle":"Ташкент","isTextInTitle":true,"zIndex":3048,"type":"placemark","coordinates":[69.123,41.456],"stroke":...
`;

const pins = parsePlacemarksFromHtml(htmlWithEscapedQuotes);

assert.equal(pins.length, 2, 'should extract both placemarks (incl. one with escaped quotes)');

// First pin — embedded escaped quotes are unescaped on capture. (The source
// label has unbalanced quoting — same as what the XLSX has — that's how the
// Yandex pin is actually authored, and matching downstream is quote-blind.)
const tricky = pins[0];
assert.equal(tricky.label, 'М.Улугбека" и "Паркентский" Шастри 2');
assert.equal(tricky.lat, 41.31699422301943);
assert.equal(tricky.lng, 69.31676828619935);

// Second pin — plain title/subtitle still works; subtitle is longer so it
// takes the city slot (existing behaviour preserved).
const plain = pins[1];
assert.equal(plain.label, 'Простой адрес');
assert.equal(plain.city, 'Ташкент');
assert.equal(plain.lat, 41.456);
assert.equal(plain.lng, 69.123);

// No false positives from non-placemark JSON objects with title/subtitle keys.
const htmlWithoutPlacemarks = String.raw`{"title":"foo","subtitle":"bar","type":"polyline","coordinates":[[1,2]]}`;
assert.equal(parsePlacemarksFromHtml(htmlWithoutPlacemarks).length, 0);

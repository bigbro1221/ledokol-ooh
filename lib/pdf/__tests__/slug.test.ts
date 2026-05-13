import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugForFilename } from '../slug';

describe('slugForFilename', () => {
  it('lowercases ASCII and joins with -', () => {
    assert.equal(slugForFilename('Hello World'), 'hello-world');
  });

  it('transliterates Cyrillic', () => {
    assert.equal(slugForFilename('РК Geely - 2 flight'), 'rk-geely-2-flight');
  });

  it('strips punctuation and collapses runs of -', () => {
    assert.equal(slugForFilename('Foo!!Bar...Baz'), 'foo-bar-baz');
  });

  it('trims leading and trailing -', () => {
    assert.equal(slugForFilename('--Foo--'), 'foo');
  });

  it('handles empty input', () => {
    assert.equal(slugForFilename(''), '');
  });

  it('handles unknown chars by dropping them', () => {
    assert.equal(slugForFilename('Café 北京 — bar'), 'cafe-bar');
  });
});

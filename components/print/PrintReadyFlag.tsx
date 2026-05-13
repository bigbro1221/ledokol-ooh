'use client';

import { useEffect, useState } from 'react';

/**
 * Sets `data-pdf-ready="1"` on its root after fonts have loaded and the
 * next two animation frames have settled. Puppeteer waits on this attribute
 * before invoking page.pdf().
 */
export function PrintReadyFlag() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if ('fonts' in document) await (document as Document & { fonts: { ready: Promise<void> } }).fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await new Promise(r => setTimeout(r, 250));
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  return <div data-pdf-ready={ready ? '1' : '0'} aria-hidden style={{ position: 'fixed', inset: 'auto 0 0 0', height: 0 }} />;
}

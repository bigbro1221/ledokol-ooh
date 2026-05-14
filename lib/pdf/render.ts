import 'server-only';
import puppeteer, { type Browser, type PDFOptions } from 'puppeteer-core';

let browserPromise: Promise<Browser> | null = null;
let pdfCount = 0;
const RECYCLE_AFTER = 200;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
      headless: true,
    });
  }
  return browserPromise;
}

async function recycleIfNeeded() {
  pdfCount++;
  if (pdfCount < RECYCLE_AFTER) return;
  pdfCount = 0;
  const old = browserPromise;
  browserPromise = null;
  if (old) {
    const b = await old;
    await b.close().catch(() => {});
  }
}

export interface RenderOptions {
  url: string;
  sessionCookie: { name: string; value: string };
  cookieDomain: string;        // e.g. "localhost"
  locale: string;              // for headerTemplate text only
  headerLeft: string;          // campaign + client
  headerRight: string;         // period range
  footerLeft: string;          // "Generated dd.mm.yyyy"
  waitTimeoutMs?: number;      // default 30000
}

export async function renderCampaignPdf(opts: RenderOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    // Forward the session cookie via Cookie header instead of page.setCookie:
    // Chromium refuses to set __Secure-prefixed cookies on non-HTTPS domains
    // (and our internal URL is http://localhost:3000). Header injection
    // bypasses that validation; the print route's NextAuth reads the cookie
    // by name from the request just the same.
    await page.setExtraHTTPHeaders({
      Cookie: `${opts.sessionCookie.name}=${opts.sessionCookie.value}`,
    });

    await page.goto(opts.url, { waitUntil: 'networkidle0', timeout: opts.waitTimeoutMs ?? 30000 });
    await page.waitForSelector('[data-pdf-ready="1"]', { timeout: opts.waitTimeoutMs ?? 30000 });

    const pdfOptions: PDFOptions = {
      format: 'A4',
      margin: { top: '40mm', bottom: '34mm', left: '22mm', right: '22mm' },
      displayHeaderFooter: true,
      printBackground: true,
      headerTemplate: buildHeaderTemplate(opts),
      footerTemplate: buildFooterTemplate(opts),
    };
    const pdf = await page.pdf(pdfOptions);
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await recycleIfNeeded();
  }
}

function buildHeaderTemplate(o: RenderOptions): string {
  return `
    <div style="width:100%;font-size:9px;font-family:sans-serif;color:#999;padding:0 22mm;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:4px;">
        <span>${escapeHtml(o.headerLeft)}</span>
        <span>${escapeHtml(o.headerRight)}</span>
      </div>
    </div>
  `;
}

function buildFooterTemplate(o: RenderOptions): string {
  return `
    <div style="width:100%;font-size:9px;font-family:sans-serif;color:#999;padding:0 22mm;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:4px;">
        <span>${escapeHtml(o.footerLeft)}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

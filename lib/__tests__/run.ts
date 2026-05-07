import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(__dirname).filter(f => f.endsWith('.test.ts')).sort();

async function main() {
  let failed = 0;
  for (const f of files) {
    console.log(`\n=== ${f} ===`);
    try {
      await import(pathToFileURL(join(__dirname, f)).href);
      console.log(`  OK`);
    } catch (err) {
      failed++;
      console.error(`  FAIL: ${(err as Error).message}`);
      console.error((err as Error).stack);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} file(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} files passed`);
}

main();

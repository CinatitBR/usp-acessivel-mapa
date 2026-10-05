/**
 * Fails when the static campus data shipped with the app exceeds its size budget.
 *
 * Usage: npm run check:data
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'public/data';
const BUDGET_KB = 1024;

let total = 0;
const measure = (directory: string) => {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      measure(path);
      continue;
    }
    const size = statSync(path).size / 1024;
    total += size;
    console.log(`  ${size.toFixed(0).padStart(5)} KB  ${path.slice(DATA_DIR.length + 1)}`);
  }
};
measure(DATA_DIR);

console.log(`Static data: ${total.toFixed(0)} KB (budget ${BUDGET_KB} KB, uncompressed)`);
if (total > BUDGET_KB) {
  console.error(`Over budget by ${(total - BUDGET_KB).toFixed(0)} KB`);
  process.exit(1);
}

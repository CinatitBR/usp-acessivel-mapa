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
for (const name of readdirSync(DATA_DIR).sort()) {
  const size = statSync(join(DATA_DIR, name)).size / 1024;
  total += size;
  console.log(`  ${size.toFixed(0).padStart(5)} KB  ${name}`);
}

console.log(`Static data: ${total.toFixed(0)} KB (budget ${BUDGET_KB} KB, uncompressed)`);
if (total > BUDGET_KB) {
  console.error(`Over budget by ${(total - BUDGET_KB).toFixed(0)} KB`);
  process.exit(1);
}

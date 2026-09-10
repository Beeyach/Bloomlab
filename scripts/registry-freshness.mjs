#!/usr/bin/env node
// Explicit --as-of makes reports byte-reproducible. Omitting it uses today's UTC date.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileContentDir,
  registryMaintenance,
  renderRegistryMaintenance,
  STALE_AFTER_DAYS,
} from '@bloomlab/content-schema/node';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--as-of', '--stale-days'].includes(args[i]) || !args[i + 1] || options[args[i]]) {
    console.error('Use content:freshness [--as-of YYYY-MM-DD] [--stale-days positive-integer].');
    process.exit(2);
  }
  options[args[i]] = args[i + 1];
}
const asOf = options['--as-of'] ?? new Date().toISOString().slice(0, 10);
const threshold =
  options['--stale-days'] === undefined ? STALE_AFTER_DAYS : Number(options['--stale-days']);
try {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(asOf) ||
    !Number.isFinite(Date.parse(asOf)) ||
    new Date(asOf).toISOString().slice(0, 10) !== asOf ||
    !Number.isSafeInteger(threshold) ||
    threshold < 1
  )
    throw new Error('Use a real YYYY-MM-DD date and a positive whole-day threshold.');
  const bundle = await compileContentDir(resolve(root, 'content'), {
    enforceLock: true,
    now: new Date(`${asOf}T00:00:00Z`),
    staleAfterDays: threshold,
  });
  const report = registryMaintenance(bundle, asOf, threshold);
  const out = resolve(root, '.content');
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, 'freshness-review.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(out, 'freshness-review.md'), renderRegistryMaintenance(report));
  console.log(
    `GHL-008: ${report.registry_count} registry records, ${report.review.length} advisory review items as of ${asOf}; older than ${threshold} UTC days. Sources unchanged.`,
  );
  for (const row of report.review)
    console.warn(
      `warn ${row.feature}: ${row.reason} (${row.status}, verified ${row.last_verified})`,
    );
  console.log('Reports: .content/freshness-review.json and .content/freshness-review.md');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Registry maintenance failed.');
  process.exitCode = 1;
}

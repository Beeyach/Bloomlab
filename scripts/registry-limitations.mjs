import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
const directory = new URL('../content/ghl-features/', import.meta.url);
const features = readdirSync(directory)
  .filter((name) => name.endsWith('.yaml'))
  .map((name) => parse(readFileSync(new URL(name, directory), 'utf8')))
  .sort((a, b) => a.id.localeCompare(b.id));
const cell = (value) =>
  String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
const block = [
  '<!-- registry-limitations:start -->',
  '## Current per-feature B/C limitations — remediation R7',
  '',
  'Exact registry projection; source dates and verification caveats are not a new manual review.',
  'A means the authored deterministic subset, not complete native-product parity. REAL_GHL still',
  'requires human fieldwork. Bloomlab conversion roles, simulated reports, inspectors, Time Machine',
  'and training-only event injectors are teaching tools, not invented native HighLevel features.',
  '',
  '| Feature / source | Fidelity | Approximation and limitations | Verification boundary |',
  '| --- | --- | --- | --- |',
  ...features
    .filter((f) => ['B', 'C'].includes(f.simulation_fidelity))
    .map(
      (f) =>
        `| ${f.id} — [${cell(f.official_name)}](${f.source_url}) | ${f.simulation_fidelity} | ${cell([f.approximation_note, ...f.known_limitations].filter(Boolean).join(' '))} | ${cell(f.last_verified instanceof Date ? f.last_verified.toISOString().slice(0, 10) : f.last_verified)}: ${cell(f.verification_note)} |`,
    ),
  '<!-- registry-limitations:end -->',
].join('\n');
if (process.argv.includes('--check')) {
  const known = readFileSync(new URL('../KNOWN_LIMITATIONS.md', import.meta.url), 'utf8');
  if (!known.includes(block))
    throw new Error('GHL-009: KNOWN_LIMITATIONS registry projection missing or stale');
  console.log(
    `GHL-009: all ${features.filter((f) => ['B', 'C'].includes(f.simulation_fidelity)).length} B/C records have exact current limitations and source boundaries.`,
  );
} else console.log(block);

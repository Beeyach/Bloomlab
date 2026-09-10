import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { secretFindings } from './security-rules.mjs';
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const failed = [];
for (const path of new Set(files)) {
  if (
    /(^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|.*\.(?:pem|key))$/.test(path) &&
    !path.endsWith('.example')
  ) {
    failed.push(`${path}: secret-file`);
    continue;
  }
  const source = readFileSync(path);
  if (source.includes(0)) continue;
  const rules = secretFindings(source.toString('utf8'));
  if (rules.length) failed.push(`${path}: ${rules.join(', ')}`);
}
if (failed.length)
  throw new Error(`SEC-001 source scan failed (values redacted):\n${failed.join('\n')}`);
console.log(
  `SEC-001: ${new Set(files).size} repository files scanned; no recognized credential literals or secret files.`,
);

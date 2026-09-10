import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { secretFindings } from './security-rules.mjs';

const root = resolve(fileURLToPath(new URL('../apps/web/dist/client', import.meta.url)));
const forbidden =
  /GOOGLE_CLOUD_CREDENTIAL|ANTHROPIC_API_KEY|ELEVENLABS_API_KEY|SYNC_KEY_PEPPER|xi-api-key|api\.elevenlabs\.io|api\.anthropic\.com|speech\.googleapis\.com|oauth2\.googleapis\.com|BEGIN PRIVATE KEY|@elevenlabs\//i;
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) check(path);
    else if (
      /\.(?:js|html|json|map)$/.test(entry.name) &&
      (forbidden.test(readFileSync(path, 'utf8')) ||
        secretFindings(readFileSync(path, 'utf8')).length > 0)
    )
      throw new Error(`SEC-001: provider code or key literal in browser output: ${entry.name}`);
  }
}
check(root);
console.log(
  'SEC-001: browser output contains no Google, Anthropic or ElevenLabs provider code or key literal.',
);

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../apps/web/dist/client', import.meta.url)));
const forbidden = /ELEVENLABS_API_KEY|xi-api-key|api\.elevenlabs\.io|@elevenlabs\//i;
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) check(path);
    else if (
      /\.(?:js|html|json|map)$/.test(entry.name) &&
      forbidden.test(readFileSync(path, 'utf8'))
    )
      throw new Error(`SEC-001: provider code or key literal in browser output: ${entry.name}`);
  }
}
check(root);
console.log('SEC-001: browser output contains no ElevenLabs provider code or key literal.');

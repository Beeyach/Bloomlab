// Read-only configuration checks. No R2 object listing, D1 query, provider call or mutation.
import { assertPrivateBucket } from './security-rules.mjs';
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token)
  throw new Error('Cloudflare configuration credentials required; privacy unverified');
for (const bucket of ['bloomlab-media-dev', 'bloomlab-media-prod']) {
  const read = async (kind) => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/r2/buckets/${bucket}/domains/${kind}`,
      {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error(
        `SEC-003: ${bucket} configuration unavailable (HTTP ${response.status}); values redacted`,
      );
    const json = await response.json();
    if (json.success !== true) throw new Error(`SEC-003: ${bucket} configuration unverified`);
    return json.result;
  };
  assertPrivateBucket(await read('managed'), await read('custom'));
  console.log(
    `SEC-003: ${bucket}: r2.dev disabled; no custom domains; no learner objects accessed.`,
  );
}

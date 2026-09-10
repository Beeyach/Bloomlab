// Return rule names only. Never include a matching credential in logs or test failures.
export function secretFindings(source) {
  const rules = {
    private_key:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----(?:\s|\\n|\\r)+[A-Za-z0-9+/]{32,}/,
    anthropic_key: /sk-ant-[A-Za-z0-9_-]{32,}/,
    google_key: /AIza[A-Za-z0-9_-]{35}/,
    github_token: /(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})/,
    provider_literal:
      /(?:ANTHROPIC_API_KEY|ELEVENLABS_API_KEY|GOOGLE_CLOUD_CREDENTIAL|SYNC_KEY_PEPPER|GHL_API_KEY)["']?\s*[:=]\s*["'][A-Za-z0-9_+/=-]{24,}["']/,
  };
  return Object.entries(rules)
    .filter(([, pattern]) => pattern.test(source))
    .map(([name]) => name);
}

export function assertPrivateBucket(managed, custom) {
  if (managed?.enabled !== false || !Array.isArray(custom?.domains) || custom.domains.length !== 0)
    throw new Error(
      'SEC-003: media bucket is public, has a custom domain, or privacy could not be verified',
    );
}

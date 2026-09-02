/** Deployment environments (spec §104, INF-004). */
export const RUNTIME_ENVIRONMENTS = ['local', 'preview', 'production'] as const;

export type RuntimeEnvironment = (typeof RUNTIME_ENVIRONMENTS)[number];

function isRuntimeEnvironment(value: unknown): value is RuntimeEnvironment {
  return typeof value === 'string' && (RUNTIME_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Validates an environment name arriving from configuration (Worker vars, Vite mode).
 * Fails fast on anything unexpected rather than silently defaulting.
 */
export function parseRuntimeEnvironment(value: unknown): RuntimeEnvironment {
  if (isRuntimeEnvironment(value)) return value;
  throw new Error(
    `Unknown runtime environment ${JSON.stringify(value)}; expected one of ${RUNTIME_ENVIRONMENTS.join(', ')}`,
  );
}

/** Anthropic's supported JSON Schema subset (verified 2026-09-07). Full constraints stay local.
 * https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations
 */
export function providerSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const unsupported = new Set([
    '$schema',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'minLength',
    'maxLength',
    'maxItems',
  ]);
  const result: Record<string, unknown> = {};
  const limits: string[] = [];
  for (const [key, value] of Object.entries(schema)) {
    if (unsupported.has(key) || (key === 'minItems' && typeof value === 'number' && value > 1)) {
      if (key !== '$schema') limits.push(`${key}: ${String(value)}`);
      continue;
    }
    if (Array.isArray(value))
      result[key] = value.map((v) =>
        typeof v === 'object' && v !== null ? providerSchema(v as Record<string, unknown>) : v,
      );
    else if (typeof value === 'object' && value !== null)
      result[key] =
        key === 'properties'
          ? Object.fromEntries(
              Object.entries(value).map(([k, v]) => [
                k,
                providerSchema(v as Record<string, unknown>),
              ]),
            )
          : providerSchema(value as Record<string, unknown>);
    else result[key] = value;
  }
  if (limits.length)
    result.description = [result.description, ...limits].filter(Boolean).join('; ');
  return result;
}

/** Object order is irrelevant; array order and JSON types are significant. No code is executed. */
function equalJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length && left.every((value, index) => equalJson(value, right[index]))
    );
  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((key) => Object.hasOwn(b, key) && equalJson(a[key], b[key]))
    );
  }
  return false;
}

export function fixtureState(
  checks: readonly { key: string; field: string; expected_json: string }[],
  answers: Record<string, string>,
): Record<string, boolean> {
  return Object.fromEntries(
    checks.map((check) => {
      let passed = false;
      try {
        const input = answers[check.field] ?? '';
        if (input.length <= 100_000)
          passed = equalJson(JSON.parse(input), JSON.parse(check.expected_json));
      } catch {
        /* Missing or malformed work fails without losing the draft. */
      }
      return [check.key, passed];
    }),
  );
}

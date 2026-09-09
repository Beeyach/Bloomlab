/** A learner-authored QA record. It records observations; it does not inspect GHL. */
export interface ReviewResponse {
  checks: Record<string, { status: 'passed' | 'failed' | 'blocked' | ''; observation: string }>;
  decision: 'release' | 'hold' | '';
}
export const emptyReview = (): ReviewResponse => ({ checks: {}, decision: '' });
export function reviewState(checks: readonly { key: string }[], value?: ReviewResponse) {
  const complete =
    checks.length > 0 &&
    checks.every(({ key }) => {
      const row = value?.checks[key];
      return (
        row &&
        ['passed', 'failed', 'blocked'].includes(row.status) &&
        row.observation.trim().length > 0
      );
    });
  const all_passed = complete && checks.every(({ key }) => value?.checks[key]?.status === 'passed');
  return {
    complete,
    all_passed,
    safe_decision:
      complete && (value?.decision === 'hold' || (value?.decision === 'release' && all_passed)),
  };
}

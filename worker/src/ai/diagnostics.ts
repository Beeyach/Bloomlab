/** Only fixed codes cross the diagnostic boundary; Error messages and Zod issues may contain
 * private submission/provider text and must never be persisted or logged. */
export type GradingFailure =
  | 'schema_invalid'
  | 'rubric_items_mismatch'
  | 'critical_result_mismatch'
  | 'learner_quotation_mismatch';

export class GradingValidationError extends Error {
  constructor(
    public code: GradingFailure,
    message: string,
  ) {
    super(message);
  }
}

export function gradingFailure(error: unknown): GradingFailure {
  return error instanceof GradingValidationError ? error.code : 'schema_invalid';
}

export function evaluationFailure(error: unknown): string {
  const allowed = [
    'provider_timeout',
    'provider_unavailable',
    'provider_rate_limited',
    'evaluation_invalid',
  ];
  return error instanceof Error && allowed.includes(error.message)
    ? error.message
    : 'evaluation_failed';
}

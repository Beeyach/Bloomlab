/** Browser/Worker contracts. Provider models, prices and secrets are server-only. */
export type AiMode = 'Off' | 'Limited' | 'Full';
export type AiCategory = 'written_coaching' | 'negotiation' | 'diagnosis' | 'call_feedback';
export interface AiGrading {
  score: number;
  rubric_results: { id: string; passed: boolean; reason: string }[];
  critical_issue: string | null;
  strengths: string[];
  improvements: string[];
  next_probe: string;
  confidence: number;
}
export interface AiEvaluationRequest {
  attempt_id: string;
  exercise_id: string;
  rubric_id: string;
  submission: string;
}
export interface AiEvaluationResponse {
  run_id: string;
  rubric_id: string;
  rubric_version: number;
  result: AiGrading;
}
export interface AiSettings {
  mode: AiMode;
  monthly_limit_usd: number;
  spent_usd: number;
  reserved_usd: number;
  categories: { category: string; cost_usd: number }[];
}

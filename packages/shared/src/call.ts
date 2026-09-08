/** Transcript and metadata contract only. No Blob, base64, object key or provider credential. */
export const CALL_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  maxDurationMs: 55_000,
  maxTranscript: 4000,
} as const;
export const CALL_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const;
export type CallMime = (typeof CALL_MIME_TYPES)[number];
export const CALL_PHASES = [
  'ready',
  'microphone_permission',
  'client_speaking',
  'learner_ready',
  'recording',
  'locally_saved',
  'uploading',
  'transcribing',
  'transcript_review',
  'evaluating',
  'resolving',
  'tts_loading',
  'text_fallback',
  'complete',
  'recoverable_error',
] as const;
export type CallPhase = (typeof CALL_PHASES)[number];
export interface CallClientLine {
  node: string;
  text: string;
  voice_line?: string;
  dynamic: boolean;
}
export interface CallTurn {
  turn: number;
  recording_id: string;
  original_transcript: string;
  confirmed_transcript: string;
  client: CallClientLine;
  response: CallClientLine;
  move: string | null;
  interpretation: 'explicit' | 'rule' | 'classifier' | 'fallback';
}
export interface CallProjection {
  complete: boolean;
  turns: number;
  /** Share of transcript words, not measured speaking time. Corrections have no penalty. */
  talk_ratio_learner: number | null;
  pitched_before_diagnosis: boolean;
  diagnosis_agreed: boolean;
  next_step_agreed: boolean;
  economically_sound: boolean;
  structurally_sound: boolean;
}
export interface CallNegotiationInput {
  action: 'clarify' | 'hold_price' | 'reduce_scope' | 'phase' | 'concession' | 'walk_away' | null;
  approach: 'address' | 'pitch' | 'ignore' | 'defensive';
  diagnosis: string | null;
  excluded: string[];
  project: number | null;
  phase: string | null;
  phase_two_project: number | null;
  timeline_days: number | null;
  concession: string | null;
}
export interface CallTurnSubmission {
  turn: number;
  recording_id: string;
  transcript: string;
  move: string | null;
  negotiation?: CallNegotiationInput;
}
export interface CallSnapshot {
  attempt_id: string;
  exercise_id: string;
  content_version: string;
  turn: number;
  current: CallClientLine;
  turns: CallTurn[];
  complete: boolean;
  projection: CallProjection;
  agreement?: {
    node: string | null;
    project: number | null;
    due_now: number | null;
    recurring: number | null;
    timeline_days: number | null;
    revisions: number | null;
    excluded: string[];
    phase: { id: string; deferred: string[]; project: number; days: number } | null;
    concessions: string[];
    balance_days: number;
  };
}
export interface CallRecording {
  recording_id: string;
  attempt_id: string;
  exercise_id: string;
  turn: number;
  mime_type: CallMime;
  byte_length: number;
  duration_ms: number;
  checksum: string;
  status:
    'uploaded' | 'transcribing' | 'stt_failed' | 'review' | 'confirmed' | 'deleting' | 'deleted';
  original_transcript: string | null;
  confirmed_transcript: string | null;
  retain: boolean;
  created_at: string;
  deleted_at: string | null;
}
/** Optional on old ActiveAttempt responses; raw audio lives in a separate local table. */
export interface CallResponse {
  version: 1;
  phase: CallPhase;
  notes: string;
  retain_audio: boolean;
  elapsed_ms: number;
  recording_id: string | null;
  transcript_draft: string;
  snapshot: CallSnapshot | null;
  move?: string | null;
  negotiation?: CallNegotiationInput;
  pending_turn?: CallTurnSubmission | null;
}

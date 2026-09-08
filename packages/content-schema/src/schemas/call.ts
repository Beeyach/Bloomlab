import { z } from 'zod';
import { requireUnique } from './common.ts';

export const CALL_MODES = [
  'cold_call',
  'discovery',
  'proposal',
  'negotiation',
  'explanation',
] as const;
export const CALL_DIMENSIONS = [
  'questions',
  'listening',
  'diagnosis',
  'clarity',
  'jargon',
  'pitch_timing',
  'objection_handling',
  'next_step',
] as const;
export const CALL_METRICS = [
  'complete',
  'turns',
  'talk_ratio_learner',
  'pitched_before_diagnosis',
  'diagnosis_agreed',
  'next_step_agreed',
  'economically_sound',
  'structurally_sound',
] as const;
const token = z.string().regex(/^[a-z][a-z0-9_-]*$/);

/** Audio orchestration adapts the existing conversation/negotiation graphs. It owns no deltas. */
export const CallConfigSchema = z
  .strictObject({
    mode: z.enum(CALL_MODES),
    objective: z.string().trim().min(20).max(600),
    anchors: z.array(z.string().trim().min(3).max(180)).max(12).default([]),
    max_turns: z.number().int().min(2).max(20).default(12),
    /** Node -> existing character line ID. The compiler verifies exact text and client ownership. */
    voice_lines: z.record(token, token).default({}),
    /** Unambiguous authored phrases resolve intent before a classifier is considered. */
    rules: z
      .array(
        z.strictObject({
          node: token,
          move: token,
          phrases: z.array(z.string().trim().min(3).max(100)).min(1),
        }),
      )
      .default([]),
    /** A tailored clarification may quote a verified span, then ask this exact authorized question. */
    open_response: z
      .strictObject({ node: token, question: z.string().trim().min(15).max(200) })
      .optional(),
  })
  .superRefine((call, ctx) => {
    requireUnique(
      ctx,
      call.rules.map((r) => `${r.node}:${r.move}`),
      ['rules'],
      'call rule',
    );
  });
export type CallConfig = z.infer<typeof CallConfigSchema>;

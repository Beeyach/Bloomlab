import { z } from 'zod';
import { ref, requireUnique } from './common.ts';

export const VOICE_LINE_KINDS = [
  'greeting',
  'objection',
  'interruption',
  'voicemail',
  'recurring',
  'scenario',
] as const;

/** VOI-004: authored identity and direction; storage locations belong to the media layer. */
export const VoiceCharacterSchema = z
  .strictObject({
    id: ref('voice-characters'),
    client: ref('clients'),
    /** Text-only roleplay characters do not promise generated audio assets. */
    asset_delivery: z.enum(['audio', 'text']).default('audio'),
    voice_id: z
      .string()
      .regex(/^[A-Za-z0-9]{20}$/)
      .refine(
        (id) => !/placeholder|example|replace|changeme/i.test(id),
        'Use a verified catalog voice ID',
      ),
    speech_rate: z.number().min(0.7).max(1.2),
    style: z.number().min(0).max(1),
    stability: z.number().min(0).max(1),
    allowed_emotion_range: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
    language: z.string().regex(/^[a-z]{2}$/),
    lines: z
      .array(
        z.strictObject({
          id: z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .max(80),
          kind: z.enum(VOICE_LINE_KINDS),
          text: z.string().trim().min(1).max(1200),
          emotion: z.string().trim().min(1).max(40),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((voice, ctx) => {
    requireUnique(
      ctx,
      voice.lines.map((line) => line.id),
      ['lines'],
      'line ID',
    );
    requireUnique(ctx, voice.allowed_emotion_range, ['allowed_emotion_range'], 'emotion');
    voice.lines.forEach((line, i) => {
      if (!voice.allowed_emotion_range.includes(line.emotion)) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'emotion'],
          message: 'Emotion is outside this character’s authored range',
        });
      }
    });
  });

export type VoiceCharacter = z.infer<typeof VoiceCharacterSchema>;
export type VoiceLine = VoiceCharacter['lines'][number];

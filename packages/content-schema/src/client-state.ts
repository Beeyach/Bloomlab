import { z } from 'zod';
import { RELATIONSHIP_STAGES } from './schemas/client.ts';
const id = z.string().min(1).max(200);
const selection = z.record(id, z.record(id, id));
/** Relationship notes and immutable attempt references only. No hidden client economics or media. */
export const ClientProgressRecordSchema = z.strictObject({
  id,
  learner_id: id,
  device_id: id,
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  revision: z.number().int().positive(),
  deleted_at: z.iso.datetime().nullable(),
  schema_version: z.literal(1),
  client_id: id,
  relationship: z.enum(RELATIONSHIP_STAGES),
  journal: z
    .array(z.strictObject({ id, at: z.iso.datetime(), text: z.string().trim().min(1).max(2000) }))
    .max(500),
  engagements: z.record(id, z.strictObject({ content_version: id, stage_attempts: selection })),
});
export type ClientProgressRecord = z.infer<typeof ClientProgressRecordSchema>;

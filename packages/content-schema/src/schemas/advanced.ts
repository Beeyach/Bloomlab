import { z } from 'zod';

/** Acceptance topics. Citations are derived from authored units and practicals. */
export const ADVANCED_TOPICS = [
  'scale.templates',
  'scale.portability',
  'scale.agency',
  'scale.specialist',
  'retention.account_strategy',
  'scale.vertical_medspa',
  'scale.vertical_coach',
  'scale.vertical_home_services',
  'scale.vertical_photographer',
  'labs.companies_objects',
  'labs.smart_lists',
  'labs.scheduling',
  'labs.payments',
  'connect.dns',
  'connect.json',
  'connect.http',
  'connect.webhooks',
  'connect.ghl_api',
  'connect.git',
  'connect.workers',
  'connect.google_cloud',
  'connect.javascript',
] as const;
export const advancedTopics = z.array(z.enum(ADVANCED_TOPICS)).default([]);

/** Objective local fixture answers, not prose quality or a claimed network execution. */
export const FixtureChecksSchema = z
  .array(
    z.strictObject({
      key: z.string().regex(/^[a-z][a-z0-9_]*$/),
      field: z.string().regex(/^[a-z][a-z0-9_]*$/),
      expected_json: z.string().refine((text) => {
        try {
          JSON.parse(text);
          return true;
        } catch {
          return false;
        }
      }, 'Fixture expected_json must be valid JSON'),
    }),
  )
  .default([]);

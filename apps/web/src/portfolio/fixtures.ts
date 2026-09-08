// Controlled saved-work fixtures for tests; never imported by product UI.
import { content } from '../content/bundle';
import { recordEvidence } from '../data/learning';
import { emptyResponse } from '../exercise/response';
import type { BloomlabDatabase } from '../data/db';
export const consultation = content.portfolio.find(
  (p) => p.id === 'PF-consultation-booking-system',
)!;
export async function savedWork(
  database: BloomlabDatabase,
  options: {
    fieldwork?: boolean;
    result?: 'passed' | 'failed' | 'partial';
    capture?: boolean;
  } = {},
) {
  const exercise = content.exercises.find(
    (e) => e.type === (options.fieldwork ? 'FIELDWORK' : 'BUILD_IT'),
  )!;
  const id = crypto.randomUUID();
  const response = emptyResponse();
  response.text = 'Controlled learner explanation: separate recovery from reminders.';
  if (options.fieldwork)
    response.fieldwork = {
      version: 1,
      contract: '{}',
      phase: 'reasoning',
      configuration: { inventory: 'Inspected training assets' },
      explanations: { explanation: 'Portable values' },
      tests: { inspect: { observed: 'Matched', status: 'passed' } },
      screenshots: { destination_workflow: crypto.randomUUID() },
      reasoning: { why: 'Verify destination references.' },
      confirmed: true,
      checkpoint: 'saved',
    };
  return recordEvidence(
    {
      skill_ids: exercise.skills,
      kind: options.fieldwork ? 'fieldwork' : 'independent_exercise',
      result: options.result ?? 'passed',
      source: { type: options.fieldwork ? 'fieldwork' : 'exercise', id: exercise.id },
      exercise_id: exercise.id,
      exercise_type: exercise.type,
      attempt_id: id,
      score: options.result === 'failed' ? 0 : 100,
      assistance: 'independent',
      difficulty: 3,
      mode: 'independent',
      response,
      ...(options.fieldwork
        ? {
            real_ghl: {
              required: true,
              provided: options.result !== 'failed',
              evidence: ['test:inspect'],
            },
          }
        : {}),
      ...(options.capture
        ? {
            portfolio_capture: {
              version: 1,
              workflows: [
                {
                  id: 'workflow-proof',
                  name: 'Recovery',
                  trigger: 'GHL-WF-APPOINTMENT-STATUS',
                  nodes: [
                    {
                      id: 'node',
                      type: 'action',
                      feature: 'GHL-WF-SEND-SMS',
                      label: 'Rebooking invitation',
                    },
                  ],
                },
              ],
              funnels: [
                {
                  id: 'funnel-proof',
                  name: 'Consultation path',
                  steps: [
                    {
                      id: 'step',
                      name: 'Book',
                      purpose: 'booking',
                      blocks: [{ role: 'calendar', connected: true }],
                    },
                  ],
                },
              ],
            },
          }
        : {}),
    },
    database,
    { recompute: false },
  );
}

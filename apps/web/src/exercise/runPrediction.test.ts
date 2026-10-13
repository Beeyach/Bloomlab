import { describe, expect, it } from 'vitest';
import type { GradingEvent } from '@bloomlab/exercise-engine';
import type { RunPredictionCheckpoint } from './response';
import { eventsAfterPrediction } from './runPrediction';

const event = (index: number): GradingEvent => ({
  type: 'sms.sent',
  at: `2026-09-10T12:00:0${index}Z`,
  index,
  fields: { contact_id: 'maria' },
});
const checkpoint: RunPredictionCheckpoint = {
  committed_at: '2026-09-10T11:59:59Z',
  prediction: { tag: 'booked' },
  scenario_id: 'SC-glowhaus-no-show',
  run_id: 'run-1',
  run_generation: 'generation-1',
  through_event_index: 2,
};

describe('RUN THE LEAD prediction boundary (EXR-006)', () => {
  it('excludes execution already present when the prediction was committed', () => {
    const source = [event(0), event(2), event(3)];
    const actual = eventsAfterPrediction(source, checkpoint, {
      run_id: 'run-1',
      generation: 'generation-1',
    });
    expect(actual.map((row) => row.index)).toEqual([3]);
    actual[0]!.type = 'mutated';
    expect(source[2]!.type).toBe('sms.sent');
  });

  it('treats a new run or reset generation as a clean post-commit execution', () => {
    expect(
      eventsAfterPrediction([event(0), event(1)], checkpoint, {
        run_id: 'run-1',
        generation: 'generation-after-reset',
      }).map((row) => row.index),
    ).toEqual([0, 1]);
    expect(
      eventsAfterPrediction([event(0)], checkpoint, {
        run_id: 'run-2',
        generation: 'generation-2',
      }).map((row) => row.index),
    ).toEqual([0]);
  });
});

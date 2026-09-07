import type { Exercise } from '@bloomlab/content-schema';
import { content } from '../../content/bundle';
import { initialNegotiation, type NegotiationState } from './engine';

/** Resolve the authored starting state, never another exercise's saved attempt. */
export function negotiationOf(
  exercise: Pick<Exercise, 'negotiation' | 'scenario'>,
  saved?: NegotiationState,
): NegotiationState | null {
  if (!exercise.negotiation) return null;
  if (saved) return saved;
  const scenario = content.scenarios.find((s) => s.id === exercise.scenario);
  const client = content.clients.find((c) => c.id === scenario?.client);
  if (!scenario || !client) throw new Error('Negotiation requires its scenario and client');
  return initialNegotiation(
    exercise.negotiation,
    client.hidden_state,
    scenario.hidden_state_overrides,
  );
}

export function negotiationSpeaker(exercise: Pick<Exercise, 'scenario'>): string {
  const scenario = content.scenarios.find((s) => s.id === exercise.scenario);
  const client = content.clients.find((c) => c.id === scenario?.client);
  return client?.team[0]?.name ?? client?.business_name ?? 'The client';
}

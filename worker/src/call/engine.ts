import { quoteOf } from '@bloomlab/exercise-engine/pricing/quote';
import type { Client, Exercise, NegotiationStrategy, Scenario } from '@bloomlab/content-schema';
import { resolveThread, projectConversation } from '@bloomlab/exercise-engine/sales/conversation';
import { wordCount } from '@bloomlab/exercise-engine/sales/words';
import {
  initialNegotiation,
  negotiationProjection,
  transitionNegotiation,
  emptyNegotiationAction,
  type NegotiationAction,
  type NegotiationState,
} from '@bloomlab/exercise-engine/negotiation/engine';
import type { CallClientLine, CallSnapshot, CallTurn } from '@bloomlab/shared';

/** Adapter around the two existing engines, not a third source of scenario consequences. */
export interface CallState {
  snapshot: CallSnapshot;
  negotiation?: NegotiationState;
}
export interface TurnChoice {
  move: string | null;
  interpretation: CallTurn['interpretation'];
  negotiation?: NegotiationAction;
  strategy?: { strategy: NegotiationStrategy; confidence: number };
}
export function initialCall(
  exercise: Exercise,
  scenario: Scenario,
  client: Client,
  attemptId: string,
  version: string,
): CallState {
  const negotiation = exercise.negotiation
    ? initialNegotiation(exercise.negotiation, client.hidden_state, scenario.hidden_state_overrides)
    : undefined;
  const node = exercise.conversation ? resolveThread(exercise.conversation, []).current : undefined;
  const negNode = exercise.negotiation?.nodes.find((n) => n.id === negotiation?.node);
  const current: CallClientLine = {
    node: node?.id ?? negNode!.id,
    text: node?.client_message ?? negNode!.message,
    dynamic: false,
  };
  return {
    negotiation,
    snapshot: {
      agreement: negotiation ? agreement(negotiation) : undefined,
      attempt_id: attemptId,
      exercise_id: exercise.id,
      content_version: version,
      turn: 0,
      current,
      turns: [],
      complete: false,
      projection: {
        complete: false,
        turns: 0,
        talk_ratio_learner: null,
        pitched_before_diagnosis: false,
        diagnosis_agreed: false,
        next_step_agreed: false,
        economically_sound: true,
        structurally_sound: true,
      },
    },
  };
}
export function advanceCall(
  state: CallState,
  exercise: Exercise,
  scenario: Scenario,
  recording: { recording_id: string; original_transcript: string },
  text: string,
  choice: TurnChoice,
): CallState {
  const next = structuredClone(state);
  const before = next.snapshot;
  let response: CallClientLine;
  let complete: boolean;
  if (exercise.negotiation && next.negotiation) {
    next.negotiation = transitionNegotiation(
      next.negotiation,
      { ...emptyNegotiationAction(), ...choice.negotiation, text },
      exercise.negotiation,
      scenario.economics ?? null,
      choice.strategy,
    );
    const last = next.negotiation.turns.at(-1)!;
    const node = exercise.negotiation.nodes.find((n) => n.id === next.negotiation?.node);
    response = {
      node: node?.id ?? 'ended',
      text: [last.reply, node?.message].filter(Boolean).join('\n\n'),
      dynamic: false,
    };
    const projection = negotiationProjection(
      exercise.negotiation,
      scenario.economics ?? null,
      next.negotiation,
    );
    complete = projection.complete;
    before.projection = {
      ...before.projection,
      economically_sound: projection.economically_sound,
      structurally_sound: projection.structurally_sound,
      diagnosis_agreed: projection.diagnosed,
      next_step_agreed: ['won', 'approval_needed', 'walked_away'].includes(next.negotiation.status),
      pitched_before_diagnosis: next.negotiation.turns.some(
        (turn, index, turns) =>
          turn.action.approach === 'pitch' && !turns.slice(0, index).some((t) => t.diagnosis),
      ),
    };
  } else {
    const turns = [
      ...before.turns.map((t) => ({
        node: t.client.node,
        move: t.move,
        text: t.confirmed_transcript,
      })),
      { node: before.current.node, move: choice.move, text },
    ];
    const thread = resolveThread(exercise.conversation!, turns);
    const projection = projectConversation(exercise.conversation!, turns);
    if (!thread.current) throw new Error('Call graph no longer matches its authored content');
    response = { node: thread.current.id, text: thread.current.client_message, dynamic: false };
    complete = thread.complete;
    before.projection = {
      ...before.projection,
      pitched_before_diagnosis: projection.pitched_before_diagnosis,
      diagnosis_agreed: projection.diagnosis_agreed,
      next_step_agreed: projection.next_step_agreed,
    };
  }
  if (next.negotiation) before.agreement = agreement(next.negotiation);
  before.turns.push({
    turn: before.turn,
    ...recording,
    confirmed_transcript: text,
    client: before.current,
    response,
    move: choice.move,
    interpretation: choice.interpretation,
  });
  before.turn++;
  before.complete = complete || before.turn >= exercise.call!.max_turns;
  before.current = response;
  const learnerWords = before.turns.reduce((sum, t) => sum + wordCount(t.confirmed_transcript), 0);
  const clientWords = before.turns.reduce(
    (sum, t) => sum + wordCount(t.client.text),
    wordCount(response.text),
  );
  before.projection = {
    ...before.projection,
    complete: before.complete,
    turns: before.turn,
    talk_ratio_learner:
      learnerWords + clientWords ? learnerWords / (learnerWords + clientWords) : null,
  };
  return next;
}

function agreement(state: NegotiationState) {
  const quote = quoteOf(state.deal.quote);
  return {
    node: state.node,
    project: quote.project,
    due_now: quote.due_now,
    recurring: quote.recurring,
    timeline_days: quote.timeline_days,
    revisions: quote.revisions,
    excluded: state.deal.quote.excluded,
    phase: state.deal.phase,
    concessions: state.deal.concessions,
    balance_days: state.deal.balance_days,
  };
}

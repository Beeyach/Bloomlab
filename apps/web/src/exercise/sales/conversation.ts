import type {
  ClosingSituation,
  Conversation,
  ConversationNode,
  DiscoveryTopic,
} from '@bloomlab/content-schema';

import type { ConversationTurnResponse } from './types';
import { sharePercent, wordCount } from './words';

/**
 * The written client thread (CONV-002, SAL-004, SAL-005, SAL-008).
 *
 * One resolver replays the authored graph against what the learner sent, and one projection
 * measures it. The branch follows the move the learner chose, never a guess at their prose: when
 * they wrote without choosing one, the thread takes the authored fallback and the client asks
 * what they meant. Nothing here decides that an answer was right, and nothing shows "Correct."
 */

export interface ThreadMessage {
  /** Position in the thread, from 1. */
  index: number;
  from: 'client' | 'learner';
  text: string;
  /** The node this message belongs to: the client's own, or the one the learner answered. */
  node: string;
  /** For a learner turn: the move they said they were making. */
  move?: string | null;
  /** For a learner turn whose move the thread could not place. */
  unclassified?: boolean;
}

export interface ResolvedThread {
  messages: ThreadMessage[];
  /** Where the thread now stands; null when a saved turn no longer matches the content. */
  current: ConversationNode | null;
  /** Nodes the learner has actually reached, in order. */
  visited: string[];
  complete: boolean;
  /** Learner turns taken when the client first agreed with the diagnosis; null if never. */
  diagnosis_at: number | null;
  /** The first learner turn that pitched, from 1; null if never. */
  pitch_at: number | null;
  topics: DiscoveryTopic[];
  situations: ClosingSituation[];
}

const nodeById = (conversation: Conversation, id: string): ConversationNode | undefined =>
  conversation.nodes.find((node) => node.id === id);

/**
 * Replays the thread. Turns that no longer name the node they answered are dropped — content
 * changed under a saved draft — rather than replayed into the wrong branch.
 */
export function resolveThread(
  conversation: Conversation,
  turns: readonly ConversationTurnResponse[],
): ResolvedThread {
  const messages: ThreadMessage[] = [];
  const visited: string[] = [];
  const topics = new Set<DiscoveryTopic>();
  const situations = new Set<ClosingSituation>();
  let current = nodeById(conversation, conversation.opening) ?? null;
  let diagnosisAt: number | null = null;
  let pitchAt: number | null = null;
  let taken = 0;

  const arrive = (node: ConversationNode) => {
    visited.push(node.id);
    for (const topic of node.covers) topics.add(topic);
    if (node.situation) situations.add(node.situation);
    if (node.diagnosis_agreed && diagnosisAt === null) diagnosisAt = taken;
    messages.push({
      index: messages.length + 1,
      from: 'client',
      text: node.client_message,
      node: node.id,
    });
  };

  if (current) arrive(current);

  for (const turn of turns) {
    if (!current || current.end || turn.node !== current.id) break;
    taken += 1;
    const move = current.moves.find((candidate) => candidate.id === turn.move) ?? null;
    if (move?.kind === 'pitch' && pitchAt === null) pitchAt = taken;
    messages.push({
      index: messages.length + 1,
      from: 'learner',
      text: turn.text,
      node: current.id,
      move: turn.move,
      unclassified: move === null,
    });
    const nextId = move ? move.next : current.fallback;
    const next = nextId ? (nodeById(conversation, nextId) ?? null) : null;
    if (!next) {
      current = null;
      break;
    }
    current = next;
    arrive(next);
  }

  return {
    messages,
    current,
    visited,
    complete: current?.end === true,
    diagnosis_at: diagnosisAt,
    pitch_at: pitchAt,
    topics: [...topics],
    situations: [...situations],
  };
}

export interface ConversationProjection {
  turns: number;
  learner_words: number;
  client_words: number;
  /** Whole percent of the thread's words that are the learner's, or null for an empty thread. */
  talk_share: number | null;
  /** Talked for more than 60% of the thread (SAL-005). */
  learner_talk_over_60: boolean;
  /** Proposed a system before the client agreed with the diagnosis (SAL-005). */
  pitched_before_diagnosis: boolean;
  diagnosis_agreed: boolean;
  complete: boolean;
  topics_covered: number;
  next_step_agreed: boolean;
  topics: Record<string, boolean>;
  situations: Record<string, boolean>;
}

export function projectConversation(
  conversation: Conversation | null,
  turns: readonly ConversationTurnResponse[],
): ConversationProjection {
  if (!conversation) {
    return {
      turns: 0,
      learner_words: 0,
      client_words: 0,
      talk_share: null,
      learner_talk_over_60: false,
      pitched_before_diagnosis: false,
      diagnosis_agreed: false,
      complete: false,
      topics_covered: 0,
      next_step_agreed: false,
      topics: {},
      situations: {},
    };
  }
  const thread = resolveThread(conversation, turns);
  const words = (from: ThreadMessage['from']) =>
    thread.messages
      .filter((message) => message.from === from)
      .reduce((sum, message) => sum + wordCount(message.text), 0);
  const learnerWords = words('learner');
  const clientWords = words('client');
  const share = sharePercent(learnerWords, learnerWords + clientWords);
  // Early is at or before the turn the agreement arrived on: that message was written without
  // having read it.
  const early =
    thread.pitch_at !== null &&
    (thread.diagnosis_at === null || thread.pitch_at <= thread.diagnosis_at);
  return {
    turns: thread.messages.filter((message) => message.from === 'learner').length,
    learner_words: learnerWords,
    client_words: clientWords,
    talk_share: share,
    learner_talk_over_60: share !== null && share > 60,
    pitched_before_diagnosis: early,
    diagnosis_agreed: thread.diagnosis_at !== null,
    complete: thread.complete,
    topics_covered: thread.topics.length,
    next_step_agreed: thread.topics.includes('next_step'),
    // Every topic and situation the thread *could* reach is present, so a check on one the
    // learner never got to reads false rather than missing.
    topics: Object.fromEntries(
      [...new Set(conversation.nodes.flatMap((node) => node.covers))].map((topic) => [
        topic,
        thread.topics.includes(topic),
      ]),
    ),
    situations: Object.fromEntries(
      [
        ...new Set(
          conversation.nodes
            .map((node) => node.situation)
            .filter((situation) => situation !== undefined),
        ),
      ].map((situation) => [situation, thread.situations.includes(situation)]),
    ),
  };
}

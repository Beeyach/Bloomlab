import { z } from 'zod';

import { clientRef, markdown, requireUnique, title } from './common.ts';

/**
 * The authored half of the selling families (spec §20–§21, §27; SAL-001 … SAL-013, CONV-002).
 *
 * Everything a sales exercise needs that is not prose lives here as data: what the learner can
 * actually see of a business, what a defensible decision about it looks like, and how a written
 * client thread continues. React renders these; it knows none of their contents, and it decides
 * nothing about them.
 *
 * The split that matters throughout is between what the learner has observed and what they have
 * assumed. `EvidenceItem.direct` is that line drawn once, in content, so a Verified claim can be
 * checked against something rather than against confident wording.
 */

const token = (what: string) =>
  z.string().regex(/^[a-z][a-z0-9_]*$/, `${what} are lower-case tokens`);

const evidenceId = z
  .string()
  .regex(/^ev-[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Evidence IDs look like ev-reply-22h');

/** Where a learner-visible observation came from. All of these are things Ary could look at. */
export const EVIDENCE_SOURCES = [
  'website',
  'landing_page',
  'google_business_profile',
  'test_enquiry',
  'phone_call',
  'email_reply',
  'public_offer',
  'ad',
  'review',
  'social',
  'referral',
  'document',
] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

/**
 * One thing the learner can see, in the learner's own view (SAL-001, §23 of the phase brief).
 *
 * This is the only evidence API a sales exercise has. A client's or scenario's `hidden_facts` are
 * deliberately not readable here: a quote follow-up rate nobody could observe must not become
 * something a finding can cite.
 */
export const EvidenceItemSchema = z.strictObject({
  id: evidenceId,
  source: z.enum(EVIDENCE_SOURCES),
  /** What was seen, in plain words. Shown to the learner exactly as written. */
  observation: z.string().trim().min(10),
  /**
   * Observed first-hand. Only direct evidence can support a **Verified** finding; indirect
   * evidence can support **Likely** and nothing stronger (SAL-001).
   */
  direct: z.boolean().default(true),
  /** The business this is about, when the exercise shows several. */
  client: clientRef.optional(),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

/** The five qualification dimensions (SAL-002). */
export const QUALIFICATION_AXES = [
  'icp_fit',
  'economics',
  'recurring_need',
  'technical_fit',
  'decision_maker_access',
] as const;
export type QualificationAxis = (typeof QUALIFICATION_AXES)[number];

/** The only three answers PROSPECT IT accepts (EXR-012). */
export const PROSPECT_DECISIONS = ['contact', 'maybe', 'skip'] as const;
export type ProspectDecision = (typeof PROSPECT_DECISIONS)[number];

const axisEvidence = z.strictObject({
  axis: z.enum(QUALIFICATION_AXES),
  /** The visible evidence that would justify naming this dimension. Never shown to the learner. */
  evidence: z.array(evidenceId).min(1),
});

/**
 * How one prospect is judged (SAL-002). Hidden evaluation data: none of it is rendered, and a
 * test pins that. Several decisions can be defensible, so `acceptable_decisions` is a list —
 * Contact is not the morally correct answer, and a Skip with the right evidence can score full
 * deterministic marks.
 */
export const ProspectBriefSchema = z
  .strictObject({
    client: clientRef,
    acceptable_decisions: z.array(z.enum(PROSPECT_DECISIONS)).min(1),
    /** The best of the acceptable answers, for the result view after the attempt. */
    strongest_decision: z.enum(PROSPECT_DECISIONS),
    axes: z.array(axisEvidence).min(1),
    /** What a Maybe would still have to resolve, in the author's words. */
    unresolved: z.string().trim().min(10).optional(),
  })
  .superRefine((brief, ctx) => {
    requireUnique(
      ctx,
      brief.axes.map((entry) => entry.axis),
      ['axes'],
      'axis',
    );
    if (!brief.acceptable_decisions.includes(brief.strongest_decision)) {
      ctx.addIssue({
        code: 'custom',
        path: ['strongest_decision'],
        message: `${brief.strongest_decision} is not one of the acceptable decisions`,
      });
    }
    if (brief.acceptable_decisions.includes('maybe') && !brief.unresolved) {
      ctx.addIssue({
        code: 'custom',
        path: ['unresolved'],
        message: 'A defensible Maybe names the condition it is waiting on',
      });
    }
  });

export type ProspectBrief = z.infer<typeof ProspectBriefSchema>;

/** The four parts of the presentation frame (SAL-006). */
export const FRAME_ELEMENTS = ['problem', 'consequence', 'system', 'outcome'] as const;
export type FrameElement = (typeof FRAME_ELEMENTS)[number];

const frameCoverage = z.strictObject({
  element: z.enum(FRAME_ELEMENTS),
  /** `response_markers` keys that count as covering this part of the frame. */
  markers: z.array(token('Marker keys')).min(1),
});

/**
 * The authored sales configuration of one exercise. Every field is optional: a BUILD IT knows
 * nothing about any of it, and an exercise only carries the parts its family needs.
 */
export const SalesConfigSchema = z
  .strictObject({
    /** What the learner can see. Shown in the work area; nothing else is. */
    evidence: z.array(EvidenceItemSchema).default([]),
    /** PROSPECT IT: how each business is judged. */
    prospect_briefs: z.array(ProspectBriefSchema).default([]),
    /** AUDIT IT: how many findings the brief asks for. */
    min_findings: z.number().int().min(1).max(12).default(3),
    /** EXPLAIN IT: which markers show that a part of the frame was covered. */
    frame: z.array(frameCoverage).default([]),
  })
  .superRefine((sales, ctx) => {
    requireUnique(
      ctx,
      sales.evidence.map((item) => item.id),
      ['evidence'],
      'evidence id',
    );
    requireUnique(
      ctx,
      sales.prospect_briefs.map((brief) => brief.client),
      ['prospect_briefs'],
      'prospect brief',
    );
    requireUnique(
      ctx,
      sales.frame.map((entry) => entry.element),
      ['frame'],
      'frame element',
    );
    const ids = new Set(sales.evidence.map((item) => item.id));
    sales.prospect_briefs.forEach((brief, index) => {
      brief.axes.forEach((entry, axisIndex) => {
        for (const id of entry.evidence) {
          if (!ids.has(id)) {
            ctx.addIssue({
              code: 'custom',
              path: ['prospect_briefs', index, 'axes', axisIndex, 'evidence'],
              message: `${id} is not one of this exercise's evidence items`,
            });
          }
        }
      });
    });
  });

export type SalesConfig = z.infer<typeof SalesConfigSchema>;

/** What the learner is doing with one message (SAL-005, §45 of the phase brief). */
export const CONVERSATION_MOVE_KINDS = [
  'ask',
  'reflect',
  'answer',
  'pitch',
  'next_step',
  'close',
  'clarify',
] as const;
export type ConversationMoveKind = (typeof CONVERSATION_MOVE_KINDS)[number];

/** The fourteen discovery topics of SAL-004, plus technical discovery. */
export const DISCOVERY_TOPICS = [
  'opening',
  'agenda',
  'current_process',
  'desired_result',
  'pain',
  'volume',
  'impact',
  'urgency',
  'tools',
  'staff',
  'stakeholders',
  'budget',
  'decision_process',
  'next_step',
  'technical',
] as const;
export type DiscoveryTopic = (typeof DISCOVERY_TOPICS)[number];

/** The five closing situations of SAL-008. */
export const CLOSING_SITUATIONS = [
  'commitment',
  'proposal_follow_up',
  'ghosting',
  'decision_delay',
  'next_step_control',
] as const;
export type ClosingSituation = (typeof CLOSING_SITUATIONS)[number];

const nodeId = token('Conversation node IDs');

const conversationMove = z.strictObject({
  id: token('Move IDs'),
  /** What the learner picks: what they are doing, never what to say. */
  label: z.string().trim().min(4).max(80),
  kind: z.enum(CONVERSATION_MOVE_KINDS),
  next: nodeId,
});

/**
 * One turn of an authored client thread (CONV-002).
 *
 * The client writes; the learner writes back and says what they are doing. The move decides where
 * the thread goes, so the branch is a fact about the learner's choice rather than a guess about
 * their prose — and the prose is kept whole for the rubric that judges it later.
 */
const conversationNode = z.strictObject({
  id: nodeId,
  /** What the client says at this point. */
  client_message: markdown,
  /** Discovery topics this exchange actually puts on the table (SAL-004). */
  covers: z.array(z.enum(DISCOVERY_TOPICS)).default([]),
  /** The closing situation staged here (SAL-008). */
  situation: z.enum(CLOSING_SITUATIONS).optional(),
  /** True once the client has agreed with the diagnosis; a pitch before this is early (SAL-005). */
  diagnosis_agreed: z.boolean().default(false),
  moves: z.array(conversationMove).default([]),
  /**
   * Where a reply whose move is not one of this node's goes. The client asks what was meant
   * rather than the engine inventing an intent it cannot know.
   */
  fallback: nodeId.optional(),
  /** The thread ends here. */
  end: z.boolean().default(false),
});

export type ConversationNode = z.infer<typeof conversationNode>;

export const CONVERSATION_CHANNELS = ['email', 'sms', 'chat'] as const;

/**
 * An authored written client thread (CONV-002). Persistent, branching, and never "Correct.":
 * the client answers as themselves and the exchange continues.
 */
export const ConversationSchema = z
  .strictObject({
    /** Who is writing; defaults to the exercise's client. */
    client: clientRef.optional(),
    subject: title,
    channel: z.enum(CONVERSATION_CHANNELS).default('email'),
    /** The first thing the learner reads. */
    opening: nodeId,
    nodes: z.array(conversationNode).min(2),
    /** The label above the composer, in the learner's words. */
    composer_help: z.string().trim().min(8),
  })
  .superRefine((conversation, ctx) => {
    const ids = conversation.nodes.map((node) => node.id);
    requireUnique(ctx, ids, ['nodes'], 'node id');
    const known = new Set(ids);
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (!known.has(conversation.opening)) {
      issue(['opening'], `${conversation.opening} is not one of the nodes`);
    }
    conversation.nodes.forEach((node, index) => {
      requireUnique(
        ctx,
        node.moves.map((move) => move.id),
        ['nodes', index, 'moves'],
        'move id',
      );
      if (node.end && node.moves.length > 0) {
        issue(['nodes', index, 'moves'], 'A closing message offers no further moves');
      }
      if (!node.end && node.moves.length === 0) {
        issue(
          ['nodes', index, 'moves'],
          'A node the thread continues from needs at least one move',
        );
      }
      if (!node.end && !node.fallback) {
        issue(
          ['nodes', index, 'fallback'],
          'Every branching node needs a fallback for a reply the move does not classify',
        );
      }
      if (node.fallback && !known.has(node.fallback)) {
        issue(['nodes', index, 'fallback'], `${node.fallback} is not one of the nodes`);
      }
      node.moves.forEach((move, moveIndex) => {
        if (!known.has(move.next)) {
          issue(
            ['nodes', index, 'moves', moveIndex, 'next'],
            `${move.next} is not one of the nodes`,
          );
        }
      });
    });
    if (!conversation.nodes.some((node) => node.end)) {
      issue(['nodes'], 'A thread needs somewhere to end');
    }
    // Everything must be reachable from the opening, or an authored branch is dead content the
    // learner can never see and a coverage claim nothing supports.
    const reached = new Set<string>();
    const queue = [conversation.opening];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (reached.has(id) || !known.has(id)) continue;
      reached.add(id);
      const node = conversation.nodes.find((candidate) => candidate.id === id);
      if (!node) continue;
      for (const move of node.moves) queue.push(move.next);
      if (node.fallback) queue.push(node.fallback);
    }
    for (const [index, node] of conversation.nodes.entries()) {
      if (!reached.has(node.id)) {
        issue(['nodes', index, 'id'], `${node.id} cannot be reached from ${conversation.opening}`);
      }
    }
  });

export type Conversation = z.infer<typeof ConversationSchema>;

/**
 * The written pieces Phase 16 trains (EXR-014, SAL-013). Every one of them is authored somewhere
 * in the curriculum; a content test proves it rather than a list in a document.
 */
export const MESSAGE_TYPES = [
  'cold_email',
  'follow_up',
  'interested_reply',
  'discovery_recap',
  'proposal_explanation',
  'client_update',
  'scope_response',
  'payment_reminder',
  'upsell',
  'breakup_email',
  'blocker',
  'delay',
  'approval',
  'revision',
  'technical_explanation',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

/** Who a written answer is for. `owner` is the reader who will never open a workflow builder. */
export const WRITING_AUDIENCES = ['owner', 'builder', 'none'] as const;
export type WritingAudience = (typeof WRITING_AUDIENCES)[number];

/**
 * The state roots a sales attempt produces, and every figure under them.
 *
 * These names are the contract between three places: the work area that shows a learner what it
 * counted, the projection that computes it once, and the assertion an exercise authors against
 * it. Keeping the vocabulary here means the content build refuses a check on a figure nothing
 * produces, instead of a learner meeting a criterion that can never be met (EXR-002, CNT-005).
 */
export const SALES_STATE_ROOTS = [
  'prospects',
  'audit',
  'message',
  'explanation',
  'conversation',
] as const;
export type SalesStateRoot = (typeof SALES_STATE_ROOTS)[number];

export const PROSPECT_METRICS = [
  'total',
  'decided',
  'with_reasoning',
  'with_axes',
  'acceptable',
  'supported',
] as const;

export const AUDIT_METRICS = [
  'findings_count',
  'classified',
  'verified',
  'likely',
  'unknown',
  'supported',
  'unsupported_claims',
  'with_verification_plan',
] as const;

export const MESSAGE_METRICS = [
  'total',
  'answered',
  'all_answered',
  'word_count',
  'within_word_limit',
  'over_limit',
  'has_next_step',
  'cites_direct_evidence',
] as const;

export const MESSAGE_FIELD_METRICS = [
  'answered',
  'word_count',
  'within_limit',
  'next_step',
  'citations',
  'cites_direct',
] as const;

export const EXPLANATION_METRICS = [
  'audiences_answered',
  'owner_jargon_count',
  'builder_jargon_count',
  'frame_covered',
] as const;

export const CONVERSATION_METRICS = [
  'turns',
  'learner_words',
  'client_words',
  'talk_share',
  'learner_talk_over_60',
  'pitched_before_diagnosis',
  'diagnosis_agreed',
  'complete',
  'topics_covered',
  'next_step_agreed',
] as const;

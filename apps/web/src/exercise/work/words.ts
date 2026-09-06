import type {
  ConversationMoveKind,
  EvidenceSource,
  MessageType,
  ProspectDecision,
  QualificationAxis,
} from '@bloomlab/content-schema';

import type { FindingClassification, FindingProblem } from '../sales';

/** The learner-facing words of the selling families. Ordinary business language, no coaching. */

export const EVIDENCE_SOURCE_WORDS: Record<EvidenceSource, string> = {
  website: 'Their website',
  landing_page: 'A landing page',
  google_business_profile: 'Google Business Profile',
  test_enquiry: 'Your test enquiry',
  phone_call: 'A phone call',
  email_reply: 'An email reply',
  public_offer: 'A published offer',
  ad: 'An ad',
  review: 'A review',
  social: 'Social',
  referral: 'A referral',
  document: 'A document they sent',
};

export const DECISION_WORDS: Record<ProspectDecision, string> = {
  contact: 'Contact',
  maybe: 'Maybe',
  skip: 'Skip',
};

export const DECISION_HELP: Record<ProspectDecision, string> = {
  contact: 'Worth an email this week.',
  maybe: 'One thing has to be answered first.',
  skip: 'Not a fit. Say what makes it one.',
};

export const AXIS_WORDS: Record<QualificationAxis, string> = {
  icp_fit: 'Fit with who you work with',
  economics: 'Economics',
  recurring_need: 'Recurring need',
  technical_fit: 'Technical fit',
  decision_maker_access: 'Access to the decision maker',
};

export const CLASSIFICATION_WORDS: Record<FindingClassification, string> = {
  verified: 'Verified',
  likely: 'Likely',
  unknown: 'Unknown',
};

export const CLASSIFICATION_HELP: Record<FindingClassification, string> = {
  verified: 'You observed it.',
  likely: 'The evidence points at it.',
  unknown: 'You would have to ask.',
};

/** Objective feedback, before any rubric exists. It says what is missing, never how good it is. */
export const FINDING_PROBLEM_WORDS: Record<FindingProblem, string> = {
  no_claim: 'Nothing written yet.',
  no_classification: 'Not labelled yet.',
  verified_without_direct_evidence:
    'Marked Verified with nothing you saw yourself behind it. Cite what you observed, or mark it Likely.',
  likely_without_evidence: 'Marked Likely with no evidence cited.',
  unknown_without_plan: 'Marked Unknown without saying what would confirm it.',
};

export const MOVE_KIND_WORDS: Record<ConversationMoveKind, string> = {
  ask: 'Question',
  reflect: 'Say it back',
  answer: 'Answer',
  pitch: 'Propose a system',
  next_step: 'Set the next step',
  close: 'Ask for a decision',
  clarify: 'Clear something up',
};

export const MESSAGE_TYPE_WORDS: Record<MessageType, string> = {
  cold_email: 'Cold email',
  follow_up: 'Follow-up',
  interested_reply: 'Reply to interest',
  discovery_recap: 'Discovery recap',
  proposal_explanation: 'Proposal explanation',
  client_update: 'Client update',
  scope_response: 'Scope response',
  payment_reminder: 'Payment reminder',
  upsell: 'Upsell',
  breakup_email: 'Breakup email',
  blocker: 'Blocker',
  delay: 'Delay',
  approval: 'Approval request',
  revision: 'Revision',
  technical_explanation: 'Technical explanation',
};

import { z } from 'zod';

export const FIELD_READY_IDENTITIES = [
  'Funnel Strategist',
  'GHL Systems Builder',
  'Conversion & Sales Operator',
  'Technical GHL Specialist',
] as const;
export const FIELD_READY_EVIDENCE_AREAS = [
  'funnel_strategy',
  'ghl_implementation',
  'automation',
  'crm_architecture',
  'troubleshooting',
  'sales',
  'pricing',
  'negotiation',
  'fieldwork',
  'client_explanation',
] as const;

/** Acceptance contracts, not learner content. Each token needs actual learn + practical citations. */
export const FIELD_READY_TOPICS = {
  funnel: [
    'customer_journey',
    'funnel_purpose',
    'traffic_intent',
    'offer',
    'friction',
    'cta',
    'conversion',
    'funnel_math',
    'bottleneck',
    'awareness',
    'traffic_source',
    'trust',
    'qualification',
    'cpl',
    'booking_rate',
    'show_rate',
    'close_rate',
    'cac',
    'aov',
    'ltv',
  ],
  families: [
    'lead_capture',
    'lead_magnet',
    'consultation',
    'appointment',
    'quote_request',
    'application',
    'assessment',
    'vsl_to_call',
    'content_to_booking',
    'service_inquiry',
    'reactivation',
  ],
  lead: ['capture', 'forms', 'confirmation', 'follow_up', 'crm_capture', 'pipeline', 'next_action'],
  data: [
    'contacts',
    'tags',
    'custom_fields',
    'custom_values',
    'opportunities',
    'pipelines',
    'assignments',
    'architecture',
    'smart_lists',
    'companies',
    'modeling',
  ],
  workflow: [
    'foundations',
    'triggers',
    'filters',
    'actions',
    'waits',
    'branching',
    'reentry',
    'timing',
    'communications',
    'pipeline_automation',
    'common_systems',
  ],
  booking: [
    'forms',
    'surveys',
    'qualification',
    'calendars',
    'routing',
    'reminders',
    'cancellations',
    'reschedules',
    'no_shows',
  ],
  conversion: [
    'hierarchy',
    'message_match',
    'cta_placement',
    'copy',
    'proof',
    'qualification_friction',
    'mobile',
    'funnel_builder',
    'websites',
    'payments',
  ],
  diagnosis: [
    'workflow',
    'funnel',
    'logs',
    'edge_cases',
    'metrics',
    'qa',
    'bottleneck',
    'deliverability',
    'sms_reliability',
    'analytics',
    'experimentation',
  ],
  qa: [
    'pages',
    'forms',
    'links',
    'validation',
    'field_mapping',
    'workflow_entry',
    'workflow_exit',
    'sms',
    'email',
    'calendar',
    'cancellation',
    'reschedule',
    'pipeline',
    'payments',
    'tracking',
    'desktop',
    'tablet',
    'mobile',
    'edge_cases',
  ],
  prospecting: [
    'icp',
    'selection',
    'evidence',
    'research',
    'outreach',
    'cold_email',
    'follow_up',
    'audit_quality',
    'social_outreach',
    'qualification',
  ],
  selling: [
    'cold_calls',
    'discovery',
    'zoom',
    'listening',
    'questions',
    'diagnosis',
    'explanation',
    'outcomes',
    'technical_discovery',
    'presentation',
    'client_language',
    'closing',
  ],
  pricing: [
    'scope',
    'fixed',
    'recurring',
    'deposit',
    'revisions',
    'exclusions',
    'risk',
    'negotiation',
    'reduce_scope',
    'walk_away',
  ],
  delivery: [
    'proposal',
    'acceptance',
    'onboarding',
    'build_order',
    'updates',
    'qa',
    'handoff',
    'change_requests',
  ],
  bloomwired: ['icp', 'positioning', 'pricing', 'audits', 'outreach', 'proposals'],
  judgment: [
    'funnel_needed',
    'automation_needed',
    'ghl_appropriate',
    'data_choice',
    'custom_code',
    'contact_prospect',
    'audit_evidence',
    'accept_project',
    'scope',
    'price',
    'complexity',
    'uncertainty',
    'what_breaks',
    'missing_verification',
  ],
} as const;
export const FIELD_READY_TOPIC_IDS = Object.entries(FIELD_READY_TOPICS).flatMap(([group, topics]) =>
  topics.map((topic) => `${group}.${topic}`),
);
export const curriculumTopics = z
  .array(
    z
      .string()
      .refine(
        (value) => FIELD_READY_TOPIC_IDS.includes(value),
        'Unknown Field Ready coverage topic',
      ),
  )
  .default([]);
export const BOSS_STAGES = [
  'audit',
  'discovery',
  'architecture',
  'pricing',
  'negotiation',
  'proposal',
  'implementation',
  'qa',
  'launch',
  'reporting',
  'change_request',
] as const;
export const CAPSTONE_INPUTS = [
  'business',
  'offers',
  'staff',
  'metrics',
  'current_systems',
  'problems',
  'hidden_edge_cases',
  'client_communications',
  'budget_constraints',
] as const;
export const CAPSTONE_ACTIONS = [
  'diagnose',
  'architect',
  'build',
  'test',
  'troubleshoot',
  'price',
  'negotiate',
  'propose',
  'explain',
] as const;

export interface FieldReadyCoverage {
  campaign: string | null;
  topics: { topic: string; units: string[]; exercises: string[] }[];
  missing_topics: string[];
  identities: { skill: string; identities: string[] }[];
  missing_identities: string[];
  missing_practical: string[];
  minutes: { instruction: number; practical: number; retrieval: number };
  ratio: { instruction: number; practical: number; retrieval: number };
  ratio_tolerance_percentage_points: number;
  ratio_passes: boolean;
  scenarios: { id: string; client: string; industry: string | null; bloomwired: boolean }[];
  bloomwired_percent: number;
  bloomwired_passes: boolean;
  exercise_families: string[];
}

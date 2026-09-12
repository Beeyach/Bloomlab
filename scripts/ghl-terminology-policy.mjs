/**
 * Explicit classifications for learner-visible product language that is not itself a registry
 * `official_name`. The audit script owns detection; this file owns the small, reviewed boundary.
 */

export const NATIVE_CONFIGURATION_TERMS = [
  {
    term: 'IVR',
    feature_ids: ['GHL-PHONE-IVR'],
    reason: 'The documented acronym for Interactive Voice Response (IVR).',
  },
  {
    term: 'Account Snapshots',
    feature_ids: ['GHL-SNAP-SNAPSHOTS'],
    reason: 'Current Agency View navigation path for the registered Snapshots product.',
  },
  {
    term: 'Advanced Filters',
    feature_ids: ['GHL-CRM-SMART-LISTS'],
    reason: 'A named filter surface inside Smart Lists, not a separate product claim.',
  },
  {
    term: 'Agent Studio',
    feature_ids: ['GHL-AI-FLOW-AGENTS', 'GHL-AI-LOGS'],
    reason: 'The registered AI records name the surrounding HighLevel studio surface.',
  },
  {
    term: 'Agency View',
    feature_ids: ['GHL-SNAP-SNAPSHOTS', 'GHL-AGENCY-SUBACCOUNTS'],
    reason: 'Navigation context, not a feature represented by Bloomlab.',
  },
  {
    term: 'Auto-Pilot',
    feature_ids: ['GHL-AI-CONVERSATION'],
    reason: 'A Conversation AI operating mode.',
  },
  {
    term: 'Execution Logs',
    feature_ids: ['GHL-AI-WORKFLOW-AGENT', 'GHL-AI-LOGS'],
    reason: 'A diagnostic view attached to the registered AI features.',
  },
  {
    term: 'Look Busy',
    feature_ids: ['GHL-CAL-CALENDARS'],
    reason: 'A calendar setting named only in the explicit omission boundary.',
  },
  {
    term: 'Minimum Scheduling Notice',
    feature_ids: ['GHL-CAL-CALENDARS'],
    reason: 'A setting inside the registered Calendars product.',
  },
  {
    term: 'Optimize for Availability',
    feature_ids: ['GHL-CAL-CALENDARS'],
    reason: 'A calendar assignment option, not a separate product.',
  },
  {
    term: 'Optimize for Equal Distribution',
    feature_ids: ['GHL-CAL-CALENDARS'],
    reason: 'A calendar assignment option, not a separate product.',
  },
  {
    term: 'Personal Booking',
    feature_ids: ['GHL-CAL-CALENDARS'],
    reason: 'A calendar type inside the registered Calendars product.',
  },
  {
    term: 'Private Integration Tokens',
    feature_ids: ['GHL-API-PRIVATE-INTEGRATIONS'],
    reason: 'The credential produced by Private Integrations, not a second integration product.',
  },
  {
    term: 'Rooms & Equipment',
    feature_ids: ['GHL-CAL-RESOURCES'],
    reason: 'A native resource configuration named only in the explicit omission boundary.',
  },
  {
    term: 'Round Robin',
    feature_ids: ['GHL-CAL-CALENDARS'],
    reason: 'A calendar type inside the registered Calendars product.',
  },
  {
    term: 'Service Calendar',
    feature_ids: ['GHL-CAL-CALENDARS', 'GHL-CAL-SERVICES'],
    reason: 'A calendar type connecting the registered Calendars and Services records.',
  },
  {
    term: 'Slot Interval',
    feature_ids: ['GHL-CAL-CALENDARS'],
    reason: 'A setting inside the registered Calendars product.',
  },
  {
    term: 'Skills Platform',
    feature_ids: ['GHL-AI-SKILLS'],
    reason: 'Short grammatical reference to the registered Skills Platform for AI Agents name.',
  },
  {
    term: 'Suggestive mode',
    feature_ids: ['GHL-AI-CONVERSATION'],
    reason: 'A Conversation AI operating mode.',
  },
  {
    term: 'Workflow AI',
    feature_ids: ['GHL-AI-DECISION-MAKER', 'GHL-AI-EXTRACT-DATA', 'GHL-AI-WORKFLOW-AGENT'],
    reason: 'A prose category for the individually registered workflow AI actions.',
  },
  {
    term: 'Marketplace',
    feature_ids: ['GHL-APP-DISTRIBUTION', 'GHL-API-WEBHOOKS'],
    reason: 'Platform and documentation context, not a simulated Bloomlab feature.',
  },
  {
    term: 'API',
    feature_ids: ['GHL-API-VERSIONING', 'GHL-API-PRIVATE-INTEGRATIONS'],
    reason: 'Generic platform interface context whose represented capabilities are registered.',
  },
  {
    term: 'Ed25519',
    feature_ids: ['GHL-API-WEBHOOKS'],
    reason: 'The current signature algorithm, not a product label.',
  },
];

export const BLOOMLAB_TERMS = [
  'Bloomlab AI',
  'Call Room',
  'Command Center',
  'Event Injector',
  'Field Ready',
  'Playground',
  'Skill Map',
  'Time Machine',
  'Run the Lead',
  'GHL AI Specialist',
  'GHL Data Foundations',
  'GHL Specialist',
  'GHL Systems Builder',
];

/** Grammatical nouns and names of fictional records are not product-label claims. */
export const GENERIC_OR_INSTANCE_TERMS = [
  'Agency Sub-Account',
  'Blog',
  'Calendar',
  'Company',
  'Community',
  'Contact',
  'Contract',
  'Conversation',
  'Course',
  'Custom Field',
  'Custom Object',
  'Custom Report',
  'Custom Value',
  'Estimate',
  'Form',
  'Funnel',
  'Invoice',
  'Managed Agent',
  'Membership',
  'Note',
  'Opportunity',
  'Payment Link',
  'Pipeline',
  'Private Integration',
  'Product',
  'Rental',
  'Resource',
  'Service',
  'Smart List',
  'Snapshot',
  'Subscription',
  'Survey',
  'Tag',
  'Task',
  'Website',
  'Webhook',
  'Workflow',
];

export const HISTORICAL_TERMS = [
  {
    term: 'Super Agents',
    path: 'content/learning-units/LU-ai-agents.mdx',
    marker: 'successor to Super Agents',
  },
  {
    term: 'SuperAgents',
    path: 'content/learning-units/LU-ai-agents.mdx',
    marker: 'Older pages still use SuperAgents terminology',
  },
  {
    term: 'X-WH-Signature',
    path: 'content/learning-units/LU-connect-webhooks.mdx',
    marker: 'was deprecated',
  },
];

/** Every named feature-bearing surface has a stable registry-integration proof. */
export const SURFACES = [
  {
    id: 'whole-repository-source-envelope',
    roots: [
      'content',
      'apps/web/src',
      'packages/content-schema/src',
      'packages/design-system/src',
      'packages/exercise-engine/src',
      'packages/mastery-engine/src',
      'packages/shared/src',
      'packages/simulator-core/src',
      'worker/src',
    ],
    proof: ['scripts/ghl-terminology.mjs', 'content/ghl-features'],
  },
  {
    id: 'academy',
    roots: ['content/learning-units', 'apps/web/src/academy'],
    proof: ['apps/web/src/academy/embeds/index.tsx', 'feature.official_name'],
  },
  {
    id: 'curriculum-and-setup',
    roots: [
      'content/campaigns',
      'content/skills',
      'content/projects',
      'content/portfolio',
      'content/glossary',
    ],
    proof: ['packages/content-schema/src/compile/validate.ts', 'MISSING_GHL_FEATURE'],
  },
  {
    id: 'exercises',
    roots: ['content/exercises', 'apps/web/src/exercise'],
    proof: ['apps/web/src/exercise/ExerciseRunner.tsx', 'feature.official_name'],
  },
  {
    id: 'workflow-palette-and-inspector',
    roots: ['apps/web/src/workflow'],
    proof: ['apps/web/src/workflow/palette.ts', 'feature.official_name'],
  },
  {
    id: 'crm-and-conversations',
    roots: ['apps/web/src/crm', 'apps/web/src/conversations'],
    proof: ['apps/web/src/content/featureNames.ts', 'nativeFeatureName'],
  },
  {
    id: 'calendar',
    roots: ['apps/web/src/calendar'],
    proof: ['apps/web/src/calendar/words.ts', 'NATIVE_LABELS.classBooking'],
  },
  {
    id: 'funnel-payments-reporting-incident',
    roots: [
      'apps/web/src/funnel',
      'apps/web/src/payments',
      'apps/web/src/reporting',
      'apps/web/src/incident',
    ],
    proof: ['apps/web/src/funnel/words.ts', "TermOrigin = 'bloomlab' | 'ghl'"],
  },
  {
    id: 'search',
    roots: ['apps/web/src/search'],
    proof: ['apps/web/src/search/SearchScreen.tsx', 'feature?.official_name'],
  },
  {
    id: 'playground',
    roots: ['apps/web/src/playground'],
    proof: ['apps/web/src/playground/Playground.tsx', 'feature.official_name'],
  },
  {
    id: 'scenarios-and-simulator',
    roots: ['content/scenarios', 'apps/web/src/simulator'],
    proof: ['packages/content-schema/src/compile/validate.ts', 'checkWorkflow'],
  },
  {
    id: 'shell-clients-fieldwork-portfolio',
    roots: [
      'apps/web/src/app',
      'apps/web/src/screens',
      'apps/web/src/clients',
      'apps/web/src/fieldwork',
      'apps/web/src/portfolio',
      'content/clients',
    ],
    proof: ['apps/web/src/content/featureNames.ts', 'content.ghl_features'],
  },
];

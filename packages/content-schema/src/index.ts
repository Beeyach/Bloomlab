/** Skill territories (spec §12, CUR-016). Zod schemas and the compiler arrive in Phase 5. */
export const TERRITORIES = [
  'STRATEGIZE',
  'BUILD',
  'AUTOMATE',
  'ARCHITECT',
  'DIAGNOSE',
  'CONNECT',
  'SELL',
  'DELIVER',
  'SCALE',
  'JUDGMENT',
] as const;

export type Territory = (typeof TERRITORIES)[number];

/** GHL capability registry enums (spec §25–§26, GHL-002 … GHL-004). */
export const IMPLEMENTATION_TYPES = [
  'native_ghl',
  'integration',
  'custom_code',
  'external_service',
] as const;

export type ImplementationType = (typeof IMPLEMENTATION_TYPES)[number];

export const GHL_FEATURE_STATUSES = ['current', 'needs_review', 'deprecated', 'removed'] as const;

export type GhlFeatureStatus = (typeof GHL_FEATURE_STATUSES)[number];

export const SIMULATION_FIDELITIES = ['A', 'B', 'C', 'REAL_GHL'] as const;

export type SimulationFidelity = (typeof SIMULATION_FIDELITIES)[number];

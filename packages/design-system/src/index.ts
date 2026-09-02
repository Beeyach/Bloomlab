// Tokens
export {
  breakpoints,
  colors,
  density,
  holo,
  inkContext,
  motion,
  roles,
  semanticColors,
  TOKEN_CATEGORIES,
  typography,
  zIndex,
  type Breakpoint,
  type ColorToken,
  type SemanticColorToken,
  type TokenCategory,
} from './tokens';
export { contrastRatio, hexToRgb, relativeLuminance, WCAG_AA } from './color/contrast';

// Hooks & utilities
export { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
export { cx } from './utils/cx';

// Layout
export { Cluster, Grid, Stack, VisuallyHidden } from './layout';

// Icons
export * from './icons';

// Primitives (DES-015)
export { HoloMaterial, type HoloMaterialProps, type HoloVariant } from './holo/HoloMaterial';
export { InkSurface, Surface, type InkSurfaceProps, type SurfaceProps } from './primitives/Surface';
export {
  Inspector,
  InspectorSection,
  ToolPanel,
  type Density,
  type InspectorProps,
  type ToolPanelProps,
} from './primitives/ToolPanel';
export { Sheet, type SheetProps } from './primitives/Sheet';
export { Popover, type PopoverProps, type PopoverTriggerProps } from './primitives/Popover';
export { Field, Input, Select, Textarea, type FieldProps } from './primitives/Field';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './primitives/Button';
export { IconButton, type IconButtonProps } from './primitives/IconButton';

// Motion (MOT-001)
export {
  ExecutionTrack,
  motionClass,
  RewardReveal,
  type ExecutionTrackProps,
  type RewardRevealProps,
} from './motion';

// Semantic components (DES-007)
export {
  ASSISTANCE_LABELS,
  EXERCISE_LABELS,
  formatCurrency,
  hashString,
  MASTERY_LABELS,
  TERRITORY_LABELS,
  type AssistanceLevel,
  type ExerciseType,
  type MasteryState,
  type Territory,
} from './semantic/domain';
export {
  StatusPill,
  type StatusGlyph,
  type StatusPillProps,
  type StatusTone,
} from './semantic/StatusPill';
export { IdentityMark, type IdentityMarkProps } from './semantic/IdentityMark';
export { MasteryBadge, type MasteryBadgeProps } from './semantic/MasteryBadge';
export { SkillCard, type SkillCardProps } from './semantic/SkillCard';
export { HoloTerritory, type HoloTerritoryProps } from './semantic/HoloTerritory';
export {
  ClientCaseCover,
  RELATIONSHIP_LABELS,
  type ClientCaseCoverProps,
  type ClientRelationship,
} from './semantic/ClientCaseCover';
export {
  WorkflowNode,
  type WorkflowNodeKind,
  type WorkflowNodeProps,
  type WorkflowNodeStatus,
} from './semantic/WorkflowNode';
export {
  ExecutionEvent,
  type ExecutionEventProps,
  type ExecutionEventStatus,
} from './semantic/ExecutionEvent';
export { ContactRow, type ContactRowProps } from './semantic/ContactRow';
export { PipelineCard, type PipelineCardProps } from './semantic/PipelineCard';
export { ExercisePrompt, type ExercisePromptProps } from './semantic/ExercisePrompt';
export { PricingScopeItem, type PricingScopeItemProps } from './semantic/PricingScopeItem';
export {
  CallParticipant,
  type AudioState,
  type CallParticipantProps,
} from './semantic/CallParticipant';

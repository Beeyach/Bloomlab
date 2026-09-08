import { PortfolioCaptureSchema, type PortfolioCapture } from '@bloomlab/content-schema';
import type { GradingArchitecture } from '@bloomlab/exercise-engine';

/** Preserve the submitted representation, never reconstruct a historical build from today's run. */
export function captureArchitecture(
  architecture: GradingArchitecture | null | undefined,
): PortfolioCapture | null {
  if (!architecture) return null;
  const parsed = PortfolioCaptureSchema.safeParse({
    version: 1,
    workflows: architecture.workflows.map((w) => ({
      id: w.id,
      name: w.name ?? 'Workflow',
      trigger: w.trigger?.ghl_feature_id ?? null,
      nodes: w.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        feature: n.ghl_feature_id ?? null,
        label: n.label ?? '',
      })),
    })),
    funnels: (architecture.funnels ?? []).map((f) => ({
      id: f.id,
      name: f.name ?? 'Funnel',
      steps: f.steps.map((s) => ({
        id: s.id,
        name: s.name ?? 'Step',
        purpose: s.purpose,
        blocks: s.blocks.map((b) => ({ role: b.role, connected: b.reference_resolved ?? null })),
      })),
    })),
  });
  // A representation outside the archive bounds must not prevent an otherwise valid submission.
  return parsed.success ? parsed.data : null;
}

import type { ContentBundle } from '../bundle.ts';
import { isoDate } from '../schemas/common.ts';
import { buildFreshness, STALE_AFTER_DAYS } from './coverage.ts';

/** Deterministic maintenance projection; no network, provider, scraping or source mutation. */
export function registryMaintenance(
  bundle: ContentBundle,
  asOf: string,
  staleAfterDays = STALE_AFTER_DAYS,
) {
  isoDate.parse(asOf);
  const review = buildFreshness(bundle, new Date(`${asOf}T00:00:00Z`), staleAfterDays);
  const statuses = { current: 0, needs_review: 0, deprecated: 0, removed: 0 };
  for (const feature of bundle.ghl_features) statuses[feature.status]++;
  return {
    schema_version: 1,
    as_of: asOf,
    stale_after_days: staleAfterDays,
    policy:
      'Flag current records older than the threshold in whole UTC days; separately retain needs_review, deprecated and removed. Flag future verification dates. A report never verifies a feature or upgrades its status.',
    content_version: bundle.content_version,
    content_hash: bundle.content_hash,
    registry_count: bundle.ghl_features.length,
    status_counts: statuses,
    review: review.map((row) => {
      const feature = bundle.ghl_features.find((f) => f.id === row.feature)!;
      return {
        ...row,
        source_url: feature.source_url,
        simulation_fidelity: feature.simulation_fidelity,
        known_limitations: [...feature.known_limitations],
        approximation_note: feature.approximation_note ?? null,
        verification_note: feature.verification_note ?? null,
      };
    }),
  };
}
export function renderRegistryMaintenance(report: ReturnType<typeof registryMaintenance>) {
  return [
    `# Registry maintenance — ${report.as_of}`,
    '',
    `Content ${report.content_version}. Stale means **more than ${report.stale_after_days} whole UTC days** since verification.`,
    '',
    report.policy,
    '',
    `${report.registry_count} records: ${Object.entries(report.status_counts)
      .map(([status, count]) => `${count} ${status}`)
      .join(', ')}. ${report.review.length} records need review.`,
    '',
    'Review the official source manually, compare the taught/simulated behavior, then deliberately update the source record and content version/lock when needed. Advisory findings do not fail CI; malformed schemas/dates or a broken content lock do. Never mass-reset verification dates.',
    '',
    ...report.review.flatMap((row) => [
      `## ${row.feature} — ${row.official_name}`,
      '',
      `Status: ${row.status}. Reason: ${row.reason}. Verified: ${row.last_verified} (${row.days_since_verified} days). Fidelity: ${row.simulation_fidelity}.`,
      '',
      `[Official source](${row.source_url})`,
      '',
      `Approximation: ${row.approximation_note ?? 'None recorded.'}`,
      '',
      'Known limitations:',
      '',
      ...(row.known_limitations.length
        ? row.known_limitations.map((item) => `- ${item}`)
        : ['- None recorded.']),
      '',
      `Verification context: ${row.verification_note ?? 'None recorded.'}`,
      '',
    ]),
  ].join('\n');
}

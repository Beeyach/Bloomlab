import { describe, expect, it, vi } from 'vitest';
import { compileSources, registryMaintenance, renderRegistryMaintenance } from '../src/node.ts';
import { baseSources } from './fixtures';

const bundle = await compileSources(baseSources(), { now: new Date('2026-09-09T00:00:00Z') });
const record = bundle.ghl_features[0]!;
const dateBefore = (days: number) =>
  new Date(Date.parse('2026-09-09T00:00:00Z') - days * 86400000).toISOString().slice(0, 10);

describe('GHL-008 dated registry maintenance', () => {
  it('flags stale current records only beyond 90 full UTC days, without rewriting their status/date', () => {
    const source = {
      ...bundle,
      ghl_features: [
        { ...record, id: 'GHL-API-RECENT', last_verified: dateBefore(1) },
        { ...record, id: 'GHL-API-BOUNDARY', last_verified: dateBefore(90) },
        { ...record, id: 'GHL-API-STALE', last_verified: dateBefore(91) },
      ],
    };
    const before = structuredClone(source);
    const result = registryMaintenance(source, '2026-09-09');
    expect(
      result.review.map((row) => [row.feature, row.status, row.reason, row.days_since_verified]),
    ).toEqual([['GHL-API-STALE', 'current', 'stale', 91]]);
    expect(result.status_counts.current).toBe(3);
    expect(source).toEqual(before);
  });
  it('keeps needs_review, deprecated and removed distinct even after recent verification', () => {
    const source = {
      ...bundle,
      ghl_features: ['needs_review', 'deprecated', 'removed'].map((status, i) => ({
        ...record,
        id: `GHL-API-REVIEW-${i}`,
        status: status as 'needs_review' | 'deprecated' | 'removed',
        last_verified: '2026-09-09',
      })),
    };
    const result = registryMaintenance(source, '2026-09-09');
    expect(result.review.map((row) => row.reason)).toEqual([
      'needs_review',
      'deprecated',
      'removed',
    ]);
    expect(result.status_counts).toEqual({
      current: 0,
      needs_review: 1,
      deprecated: 1,
      removed: 1,
    });
  });
  it('retains source, verification notes, fidelity and every limitation in a stable review list', () => {
    const feature = {
      ...record,
      status: 'needs_review' as const,
      approximation_note: 'Controlled approximation',
      verification_note: 'Manual reference review',
      known_limitations: ['First boundary', 'Second boundary'],
    };
    const source = {
      ...bundle,
      ghl_features: [
        { ...feature, id: 'GHL-API-Z' },
        { ...feature, id: 'GHL-API-A' },
      ],
    };
    const result = registryMaintenance(source, '2026-09-09');
    expect(result.review.map((row) => row.feature)).toEqual(['GHL-API-A', 'GHL-API-Z']);
    expect(result.review[0]).toMatchObject({
      source_url: feature.source_url,
      simulation_fidelity: feature.simulation_fidelity,
      known_limitations: feature.known_limitations,
      verification_note: feature.verification_note,
    });
    expect(JSON.stringify(registryMaintenance(source, '2026-09-09'))).toBe(JSON.stringify(result));
    const rendered = renderRegistryMaintenance(result);
    for (const text of [
      '2026-09-09',
      'more than 90',
      feature.source_url,
      ...feature.known_limitations,
      feature.approximation_note,
      feature.verification_note,
      'never verifies',
    ])
      expect(rendered).toContain(text);
  });
  it.each(['2026-02-30', '2026-13-01', 'not-a-date'])(
    'rejects malformed verification and reference date %s',
    (bad) => {
      expect(() =>
        registryMaintenance(
          { ...bundle, ghl_features: [{ ...record, last_verified: bad }] },
          '2026-09-09',
        ),
      ).toThrow();
      expect(() => registryMaintenance(bundle, bad)).toThrow();
    },
  );
  it('flags future verification dates without claiming that elapsed review happened', () => {
    const result = registryMaintenance(
      { ...bundle, ghl_features: [{ ...record, last_verified: '2026-09-10' }] },
      '2026-09-09',
    );
    expect(result.review[0]).toMatchObject({
      reason: 'future_verification',
      status: 'current',
      days_since_verified: -1,
    });
  });
  it('accepts an explicit threshold, rejects invalid thresholds, and never calls the network', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      const source = { ...bundle, ghl_features: [{ ...record, last_verified: dateBefore(31) }] };
      expect(registryMaintenance(source, '2026-09-09', 30).review).toHaveLength(1);
      for (const threshold of [0, -1, 1.5, NaN, Infinity])
        expect(() => registryMaintenance(source, '2026-09-09', threshold)).toThrow();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});

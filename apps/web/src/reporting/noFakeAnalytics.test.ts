import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { METRIC_IDS } from '@bloomlab/simulator-core';

/**
 * REP-003: no fake analytics anywhere in the product.
 *
 * The requirement is the invariant, and it is wider than anything a scan can settle: a number a
 * learner reads has to come from their own evidence or from a simulator run, and the business
 * arithmetic behind a reporting figure belongs to the projection. This file does not prove that.
 * It is a regression guard over the two shapes the invariant has actually been broken by here —
 * a percentage or a money amount written as a literal into learner-facing markup, and a division
 * handed straight to a percentage or currency formatter outside `reporting/`.
 *
 * So read the failures as real and the silence as narrow. A rate assembled over several
 * statements, or formatted some other way, reads as ordinary code to these patterns. Keeping
 * REP-003 true still takes reading a reporting change; what this stops is the same mistake
 * arriving twice, which is what a note in an audit report cannot do.
 *
 * What it deliberately does not object to: numbers derived from the learner's own evidence or
 * from a simulator run. A progress count is a fact about the learner, a contrast ratio is a
 * measurement, an engine timing is a measurement, and a byte size is a byte size. The rule is
 * that a number a learner reads must come from somewhere, not that screens must be numberless.
 * Authored scenario facts are evidence too: a curriculum file naming the forty visits a fixture
 * really holds is teaching material, and nothing here scans content.
 *
 * Flag-gated developer surfaces are excluded by name: the design gallery deliberately shows made
 * up figures because it is a swatch board for components, and a learner never sees it.
 */

const ROOT = join(process.cwd(), 'apps', 'web', 'src');

/** Developer surfaces behind a feature flag, and test files. Not learner-facing. */
const NOT_LEARNER_FACING =
  /(screens\/(DesignGallery|SystemDiagnostics|SimulatorHarness|HoloDiagnostic|LearningDiagnostics|ContentDiagnostics|LocalDataDiagnostics|DeviceIdentity))|\.test\./;

function modules(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) modules(path, found);
    else if (/\.tsx?$/.test(path) && !NOT_LEARNER_FACING.test(path)) found.push(path);
  }
  return found;
}

/** What a fabricated number looks like when somebody writes one into a screen. */
const FABRICATED: { pattern: RegExp; what: string }[] = [
  { pattern: />\s*\d+(\.\d+)?\s*%/g, what: 'a percentage written straight into the markup' },
  { pattern: />\s*[$£€]\s*[\d,]+/g, what: 'a money amount written straight into the markup' },
  { pattern: /\{\s*['"`]\d+(\.\d+)?%['"`]\s*\}/g, what: 'a percentage passed as a literal string' },
];

describe('REP-003: no fake analytics on any learner-facing screen', () => {
  const files = modules(ROOT);

  it('has learner-facing modules to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('finds no percentage or money amount written straight into learner-facing markup', () => {
    const offences: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      for (const { pattern, what } of FABRICATED) {
        for (const match of code.matchAll(pattern)) {
          const line = code.slice(0, match.index).split('\n').length;
          offences.push(`${file.slice(ROOT.length)}:${line} — ${what}: ${match[0].trim()}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  /**
   * The other half of REP-003: where reporting numbers do appear, they come from one place. A
   * second implementation of a rate in React is how fake analytics gets in through the front
   * door — the screen and the report would disagree and only one of them would be checked.
   *
   * The pattern below is the one that actually appeared: a division passed directly to `percent`,
   * `money` or `formatCurrency`. That is the shape this catches, not every shape a React-side
   * rate could take, so a pass here means this regression has not returned rather than that the
   * projection is provably the only implementation.
   */
  it('finds no rate divided and formatted outside the projection', () => {
    const owners = [
      'reporting/report.ts',
      'reporting/funnelAutopsy.ts',
      'reporting/provenance.ts',
      'reporting/definitions.ts',
    ];
    const offences: string[] = [];
    for (const file of files) {
      if (owners.some((owner) => file.endsWith(owner))) continue;
      if (file.includes('/reporting/window.ts')) continue;
      const code = readFileSync(file, 'utf8');
      // A division being formatted as a percentage or a money amount is a rate, and rates belong
      // to the projection. A ratio used for a bar's width is arithmetic about pixels, not about
      // the business, and is deliberately not caught here.
      for (const match of code.matchAll(
        /\b(percent|money|formatCurrency)\(\s*[\w.]+\s*\/\s*[\w.]+/g,
      )) {
        const line = code.slice(0, match.index).split('\n').length;
        offences.push(`${file.slice(ROOT.length)}:${line} — ${match[0].trim()}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('pins the metric list at ten, so an eleventh cannot be added without saying so', () => {
    expect(METRIC_IDS).toHaveLength(10);
  });
});

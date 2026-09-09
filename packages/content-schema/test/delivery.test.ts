import { expect, it } from 'vitest';
import { SequenceStepsSchema } from '../src/schemas/sequence.ts';
import { compileContentDir } from '../src/node.ts';
import { fileURLToPath } from 'node:url';
it('rejects unknown, cyclic and duplicate build-plan steps', () => {
  const a = {
    key: 'data',
    label: 'Data',
    brief: 'Settle contact identity.',
    depends_on: [] as string[],
  };
  for (const steps of [
    [a, a],
    [{ ...a, depends_on: ['unknown'] }],
    [{ ...a, depends_on: ['data'] }],
  ])
    expect(SequenceStepsSchema.safeParse(steps).success).toBe(false);
});
it('Gates 8–11 have learning and the required practical and pressure vehicles', async () => {
  const bundle = await compileContentDir(
    fileURLToPath(new URL('../../../content', import.meta.url)),
  );
  for (const gate of bundle.campaigns
    .find((row) => row.id === 'CAMP-FIELD_READY')!
    .gates.filter((row) => row.number >= 8 && row.number <= 11))
    for (const skill of gate.skills) {
      expect(
        bundle.learning_units.some((row) => row.skills.includes(skill)),
        skill,
      ).toBe(true);
      const practical = bundle.exercises.filter(
        (row) => row.skills.includes(skill) && !row.placement_area,
      );
      expect(practical.length, skill).toBeGreaterThan(0);
      if (gate.pass_criteria.pressure_test_required)
        expect(
          practical.some((row) => row.mode === 'pressure'),
          skill,
        ).toBe(true);
    }
});

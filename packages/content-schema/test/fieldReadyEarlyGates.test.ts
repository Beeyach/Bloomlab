import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { compileContentDir } from '../src/node.ts';
it('Gates 1–7 have learning, practice and every required pressure/fieldwork vehicle', async () => {
  const bundle = await compileContentDir(
    fileURLToPath(new URL('../../../content', import.meta.url)),
  );
  const campaign = bundle.campaigns.find((row) => row.id === 'CAMP-FIELD_READY')!;
  for (const gate of campaign.gates.filter((row) => row.number > 0 && row.number <= 7)) {
    expect(gate.skills.length, gate.id).toBeGreaterThan(0);
    for (const skill of gate.skills) {
      const exercises = bundle.exercises.filter(
        (row) => row.skills.includes(skill) && !row.placement_area,
      );
      expect(
        bundle.learning_units.some((row) => row.skills.includes(skill)),
        `${skill} learns`,
      ).toBe(true);
      expect(exercises.length, `${skill} practises`).toBeGreaterThan(0);
      if (gate.pass_criteria.pressure_test_required)
        expect(
          exercises.some((row) => row.mode === 'pressure'),
          `${skill} pressure`,
        ).toBe(true);
      if (gate.pass_criteria.fieldwork_required)
        expect(
          exercises.some((row) => row.type === 'FIELDWORK' && row.fieldwork?.proof),
          `${skill} fieldwork`,
        ).toBe(true);
    }
  }
});

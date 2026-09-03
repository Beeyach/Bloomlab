import { describe, expect, it } from 'vitest';

import type { IssueCode } from '../src/bundle.ts';
import { ContentBuildError, compileSources, validateSources } from '../src/node.ts';
import {
  baseSources,
  campaign,
  client,
  exercise,
  scenario,
  skillA,
  skillB,
  withFile,
  yaml,
} from './fixtures.ts';

/** Compiles and returns the issue codes the build failed with. */
async function failsWith(
  sources: ReturnType<typeof baseSources>,
  options = {},
): Promise<IssueCode[]> {
  try {
    await compileSources(sources, options);
  } catch (error) {
    if (error instanceof ContentBuildError) {
      return error.issues.filter((issue) => issue.level === 'error').map((issue) => issue.code);
    }
    throw error;
  }
  throw new Error('Expected the build to fail');
}

describe('the minimal fixture', () => {
  it('compiles, with every relationship resolved', async () => {
    const bundle = await compileSources(baseSources());
    expect(bundle.content_version).toBe('2026.09.01');
    expect(bundle.counts).toMatchObject({
      skills: 2,
      'ghl-features': 3,
      exercises: 1,
      'learning-units': 1,
    });
    expect(bundle.graph.order).toEqual(['SK-AUTOMATE-alpha', 'SK-DIAGNOSE-beta']);
    expect(bundle.indexes.exercises_by_scenario['SC-acme-welcome']).toEqual([
      'EX-BUILD_IT-welcome',
    ]);
    expect(bundle.indexes.exercises_by_client['CL-acme']).toEqual(['EX-BUILD_IT-welcome']);
    expect(bundle.learning_units[0]?.embeds.map((e) => e.component)).toEqual([
      'Feature',
      'Depth',
      'Exercise',
    ]);
    expect(bundle.learning_units[0]?.depth_sections).toEqual(['More']);
  });
});

describe('the build fails on (CNT-005, GHL-004)', () => {
  it('a duplicate ID', async () => {
    const codes = await failsWith(withFile('skills/SK-AUTOMATE-alpha.yml', yaml(skillA)));
    expect(codes).toContain('DUPLICATE_ID');
  });

  it('a file whose name is not its id', async () => {
    const codes = await failsWith(withFile('skills/SK-AUTOMATE-other.yaml', yaml(skillA)));
    expect(codes).toContain('ID_MISMATCH');
  });

  it('a missing prerequisite', async () => {
    const codes = await failsWith(
      withFile(
        'skills/SK-DIAGNOSE-beta.yaml',
        yaml({ ...skillB, prerequisites: ['SK-AUTOMATE-ghost'] }),
      ),
    );
    expect(codes).toContain('MISSING_PREREQUISITE');
  });

  it('a prerequisite cycle', async () => {
    const codes = await failsWith(
      withFile(
        'skills/SK-AUTOMATE-alpha.yaml',
        yaml({ ...skillA, prerequisites: ['SK-DIAGNOSE-beta'] }),
      ),
    );
    expect(codes).toContain('PREREQUISITE_CYCLE');
  });

  it('a skill whose id and territory disagree', async () => {
    const codes = await failsWith(
      withFile('skills/SK-AUTOMATE-alpha.yaml', yaml({ ...skillA, territory: 'BUILD' })),
    );
    expect(codes).toContain('TERRITORY_MISMATCH');
  });

  it('a missing GHL feature reference', async () => {
    const codes = await failsWith(
      withFile('skills/SK-AUTOMATE-alpha.yaml', yaml({ ...skillA, ghl_features: ['GHL-WF-NOPE'] })),
    );
    expect(codes).toContain('MISSING_GHL_FEATURE');
  });

  it('an exercise pointing at a missing scenario', async () => {
    const codes = await failsWith(
      withFile(
        'exercises/EX-BUILD_IT-welcome.yaml',
        yaml({ ...exercise, scenario: 'SC-acme-missing' }),
      ),
    );
    expect(codes).toContain('MISSING_SCENARIO');
  });

  it('a scenario pointing at a missing client', async () => {
    const codes = await failsWith(
      withFile('scenarios/SC-acme-welcome.yaml', yaml({ ...scenario, client: 'CL-nobody' })),
    );
    expect(codes).toContain('MISSING_CLIENT');
  });

  it('an exercise whose client differs from its scenario', async () => {
    const codes = await failsWith(
      withFile(
        'clients/CL-other.yaml',
        yaml({ ...client, id: 'CL-other' }),
        withFile('exercises/EX-BUILD_IT-welcome.yaml', yaml({ ...exercise, client: 'CL-other' })),
      ),
    );
    expect(codes).toContain('SCENARIO_CLIENT_MISMATCH');
  });

  it('a campaign referencing a missing skill', async () => {
    const broken = {
      ...campaign,
      gates: [{ ...campaign.gates[0], skills: ['SK-SELL-nothing'] }, campaign.gates[1]],
    };
    const codes = await failsWith(withFile('campaigns/CAMP-TEST.yaml', yaml(broken)));
    expect(codes).toContain('MISSING_SKILL');
  });

  it('a campaign that teaches a prerequisite after the skill that needs it', async () => {
    const swapped = {
      ...campaign,
      gates: [
        { ...campaign.gates[0], skills: ['SK-DIAGNOSE-beta'] },
        { ...campaign.gates[1], skills: ['SK-AUTOMATE-alpha'] },
      ],
    };
    const codes = await failsWith(withFile('campaigns/CAMP-TEST.yaml', yaml(swapped)));
    expect(codes).toContain('CAMPAIGN_PREREQUISITE_ORDER');
  });

  it('a campaign that never teaches a prerequisite', async () => {
    const partial = { ...campaign, gates: [{ ...campaign.gates[1], number: 1, id: 'GATE-1' }] };
    const codes = await failsWith(withFile('campaigns/CAMP-TEST.yaml', yaml(partial)));
    expect(codes).toContain('CAMPAIGN_MISSING_PREREQUISITE');
  });

  it('a campaign referencing a missing project', async () => {
    const broken = {
      ...campaign,
      gates: [campaign.gates[0], { ...campaign.gates[1], projects: ['PRJ-ghost'] }],
    };
    const codes = await failsWith(withFile('campaigns/CAMP-TEST.yaml', yaml(broken)));
    expect(codes).toContain('MISSING_PROJECT');
  });

  it('a REAL_GHL feature offered as a simulator action', async () => {
    const codes = await failsWith(
      withFile(
        'exercises/EX-BUILD_IT-welcome.yaml',
        yaml({ ...exercise, allowed_features: [...exercise.allowed_features, 'GHL-SNAP-REAL'] }),
      ),
    );
    expect(codes).toContain('REAL_GHL_AS_SIMULATOR_ACTION');
  });

  it('a trigger used where an action belongs', async () => {
    const wrong = {
      ...scenario,
      initial_account_state: {
        ...scenario.initial_account_state,
        workflows: [
          {
            ...scenario.initial_account_state.workflows[0],
            nodes: [
              {
                id: 'n1',
                type: 'action',
                ghl_feature_id: 'GHL-WF-TRIGGER',
                position: { x: 0, y: 0 },
              },
              { id: 'n2', type: 'end', position: { x: 0, y: 100 } },
            ],
          },
        ],
      },
    };
    const codes = await failsWith(withFile('scenarios/SC-acme-welcome.yaml', yaml(wrong)));
    expect(codes).toContain('FEATURE_TYPE_MISMATCH');
  });

  it('a removed feature still referenced', async () => {
    const removed = withFile(
      'ghl-features/GHL-WF-ACTION.yaml',
      yaml({
        id: 'GHL-WF-ACTION',
        official_name: 'Old action',
        area: 'Workflows',
        feature_type: 'action',
        implementation_type: 'native_ghl',
        status: 'removed',
        simulation_fidelity: 'A',
        last_verified: '2026-09-01',
        source_url: 'https://help.gohighlevel.com/support/solutions/articles/1',
        known_limitations: ['Removed from GHL in 2026.'],
        skills: [],
        supported_configs: {},
      }),
    );
    const codes = await failsWith(removed);
    expect(codes).toContain('REMOVED_FEATURE_REFERENCED');
  });

  it('a rubric that does not apply to the exercise type', async () => {
    const codes = await failsWith(
      withFile(
        'exercises/EX-BUILD_IT-welcome.yaml',
        yaml({ ...exercise, grading: { mode: 'mixed', rubric: 'TEST_RUBRIC_V1' } }),
      ),
    );
    expect(codes).toContain('RUBRIC_TYPE_MISMATCH');
  });

  it('a missing rubric', async () => {
    const codes = await failsWith(
      withFile(
        'exercises/EX-BUILD_IT-welcome.yaml',
        yaml({ ...exercise, grading: { mode: 'mixed', rubric: 'GHOST_RUBRIC_V1' } }),
      ),
    );
    expect(codes).toContain('MISSING_RUBRIC');
  });

  it('a file in a format the folder does not accept', async () => {
    const codes = await failsWith(
      withFile('skills/SK-AUTOMATE-json.json', '{"id":"SK-AUTOMATE-json"}'),
    );
    expect(codes).toContain('INVALID_FORMAT');
  });

  it('a file outside the content folders', async () => {
    const codes = await failsWith(withFile('lessons/anything.yaml', 'id: x'));
    expect(codes).toContain('INVALID_FORMAT');
  });

  it('an enum value outside the allowed set', async () => {
    const codes = await failsWith(
      withFile('ghl-features/GHL-WF-ACTION.yaml', yaml({ id: 'GHL-WF-ACTION', status: 'active' })),
    );
    expect(codes).toContain('SCHEMA');
  });

  it('a learning unit with an MDX syntax error', async () => {
    const codes = await failsWith(
      withFile(
        'learning-units/LU-welcome.mdx',
        `---\nid: LU-welcome\ntitle: Broken unit\nterritory: AUTOMATE\ntier: field_ready\nskills: [SK-AUTOMATE-alpha]\nestimated_minutes: 5\nsummary: A unit whose body does not parse because of an unclosed tag.\n---\n\n<Depth title="x">\n`,
      ),
    );
    expect(codes).toContain('MDX_SYNTAX');
  });

  it('a learning unit embedding an unknown component or a missing exercise', async () => {
    const body = (embed: string) =>
      `---\nid: LU-welcome\ntitle: Embed unit\nterritory: AUTOMATE\ntier: field_ready\nskills: [SK-AUTOMATE-alpha]\nestimated_minutes: 5\nsummary: A unit that embeds something the compiler must check carefully.\n---\n\n${embed}\n`;
    expect(
      await failsWith(withFile('learning-units/LU-welcome.mdx', body('<Quiz id="q" />'))),
    ).toContain('UNKNOWN_EMBED');
    expect(
      await failsWith(
        withFile('learning-units/LU-welcome.mdx', body('<Exercise id="EX-FIX_IT-ghost" />')),
      ),
    ).toContain('MISSING_EXERCISE');
    expect(
      await failsWith(withFile('learning-units/LU-welcome.mdx', body('<Simulation />'))),
    ).toContain('EMBED_MISSING_ATTRIBUTE');
  });

  it('a missing manifest', async () => {
    const codes = await failsWith(withFile('content.yaml', null));
    expect(codes).toContain('MANIFEST');
  });

  it('an out-of-date lock when the lock is enforced', async () => {
    const sources = withFile(
      'content.lock.yaml',
      yaml({ content_version: '2026.09.01', content_hash: 'a'.repeat(64), files: 15 }),
    );
    expect(await failsWith(sources, { enforceLock: true })).toContain('LOCK_MISMATCH');
    await expect(compileSources(sources)).resolves.toBeTruthy();
  });
});

describe('validateSources', () => {
  it('reports every error at once instead of stopping at the first', async () => {
    const sources = withFile(
      'skills/SK-DIAGNOSE-beta.yaml',
      yaml({ ...skillB, prerequisites: ['SK-AUTOMATE-ghost'], ghl_features: ['GHL-WF-NOPE'] }),
      withFile('scenarios/SC-acme-welcome.yaml', yaml({ ...scenario, client: 'CL-nobody' })),
    );
    const result = await validateSources(sources);
    expect(result.bundle).toBeNull();
    const codes = result.issues.filter((i) => i.level === 'error').map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining(['MISSING_PREREQUISITE', 'MISSING_GHL_FEATURE', 'MISSING_CLIENT']),
    );
  });

  it('keeps warnings out of the failure path', async () => {
    const result = await validateSources(baseSources());
    expect(result.bundle).not.toBeNull();
    // beta has no unit and no exercise: reported, never fatal
    expect(result.bundle?.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['SKILL_NO_UNIT', 'SKILL_NO_PRACTICE']),
    );
  });
});

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';

import { Button, Field, Select, Stack, StatusPill, Surface } from '@bloomlab/design-system';
import { validateScenario, type SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { db } from '../data/db';
import { useSkillProgress } from '../data/learning';
import { savedRuns } from '../simulator/currentRun';
import { startRun } from '../simulator/store';
import { CRM_SCENARIO_ID } from '../crm/useCrmRun';
import { unlockedFeatures } from './unlocks';
import styles from './playground.module.css';

/**
 * The Playground (SIM-015, D-111).
 *
 * Free experimentation with what has been unlocked, with no exercise assigned. The Playground
 * owns no simulator of its own: it lists the runnable scenarios, starts or resumes a saved run of
 * the one chosen, and opens the Labs on it — the same run, the same account, the same engine.
 * What it adds is the unlock rule made visible: every feature the learner has earned, how they
 * earned it, and whether the simulator runs it or GHL does.
 */

const scenarios = (content.scenarios as unknown as SimulatorScenario[]).filter(
  (candidate) => validateScenario(candidate).length === 0,
);

export default function Playground() {
  const progress = useSkillProgress();
  const runs = useLiveQuery(
    () => db.sim_projects.filter((row) => row.deleted_at === null).toArray(),
    [],
  );
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? '');
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const scenario = scenarios.find((row) => row.id === scenarioId) ?? scenarios[0] ?? null;

  const unlocked = useMemo(
    () =>
      unlockedFeatures(content.ghl_features, content.skills, progress ?? [], runs ?? [], scenarios),
    [progress, runs],
  );
  const runsOfChosen = (runs ?? []).filter((row) => row.scenario_id === scenario?.id);

  const open = async () => {
    if (!scenario) return;
    setStarting(true);
    setProblem(null);
    try {
      const saved = await savedRuns(scenario.id);
      if (saved.length === 0) await startRun(scenario);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The run could not be started.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Stack as="section" gap={4} className={styles.screen} aria-labelledby="playground-title">
      <div className={styles.header}>
        <h1 id="playground-title" className={styles.title}>
          Playground
        </h1>
        <p className={styles.lead}>
          Try things with no exercise attached. Pick a scenario, open it in a Lab, and use whatever
          you have unlocked. Nothing here is graded.
        </p>
      </div>

      <Surface tone="snow" padding="md">
        <div className={styles.scenarioRow}>
          <Field label="Scenario" id="playground-scenario" className={styles.scenarioChoice}>
            <Select
              value={scenario?.id ?? ''}
              onChange={(event) => setScenarioId(event.target.value)}
            >
              {scenarios.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title ?? row.id}
                </option>
              ))}
            </Select>
          </Field>
          <p className={styles.muted}>
            {runsOfChosen.length === 0
              ? 'Not opened yet. The first Lab you open starts a run and keeps it.'
              : `${runsOfChosen.length} saved run${runsOfChosen.length === 1 ? '' : 's'}. The Labs resume the one you were working in.`}
          </p>
        </div>
        {scenario && (
          <div className={styles.actions}>
            <Button size="sm" loading={starting} onClick={() => void open()} data-testid="open-run">
              {runsOfChosen.length === 0 ? 'Start this scenario' : 'Resume this scenario'}
            </Button>
            <Link className={styles.linkButton} to={`/workflow?scenario=${scenario.id}`}>
              Open in Workflow Lab
            </Link>
            <Link className={styles.linkButton} to={`/conversations?scenario=${scenario.id}`}>
              Open Conversations
            </Link>
            {scenario.id === CRM_SCENARIO_ID && (
              <Link className={styles.linkButton} to="/crm">
                Open in CRM Lab
              </Link>
            )}
          </div>
        )}
        {problem && (
          <p className={styles.refusal} role="alert">
            {problem}
          </p>
        )}
      </Surface>

      <section aria-labelledby="unlocked-title" className={styles.section}>
        <h2 id="unlocked-title" className={styles.sectionTitle}>
          Unlocked features
        </h2>
        <p className={styles.muted}>
          A feature unlocks when a skill that teaches it has any evidence, or when you have opened a
          scenario that uses it. It never locks again.
        </p>
        {progress === undefined || runs === undefined ? (
          <p className={styles.muted}>Reading your progress…</p>
        ) : unlocked.length === 0 ? (
          <p className={styles.muted} data-testid="nothing-unlocked">
            Nothing yet. Open a scenario above or work through an Academy unit, and what you meet
            there appears here.
          </p>
        ) : (
          <ul className={styles.features} aria-label="Unlocked features">
            {unlocked.map(({ feature, via, by }) => {
              const simulated =
                feature.simulation_fidelity === 'A' || feature.simulation_fidelity === 'B';
              return (
                <li key={feature.id} className={styles.feature} data-feature={feature.id}>
                  <span className={styles.featureName}>{feature.official_name}</span>
                  <span className={styles.featureArea}>{feature.area}</span>
                  <StatusPill
                    label={
                      feature.simulation_fidelity === 'A'
                        ? 'Simulated'
                        : feature.simulation_fidelity === 'B'
                          ? 'Training approximation'
                          : 'Practised in GHL'
                    }
                    tone={simulated ? 'success' : 'neutral'}
                    glyph={simulated ? 'check' : 'dash'}
                  />
                  <span className={styles.featureVia}>
                    {via === 'skill'
                      ? `From ${content.skills.find((skill) => skill.id === by)?.title ?? by}`
                      : `Met in ${scenarios.find((row) => row.id === by)?.title ?? by}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Stack>
  );
}

import {
  FIELD_READY_TOPIC_IDS,
  BOSS_STAGES,
  CAPSTONE_INPUTS,
  CAPSTONE_ACTIONS,
} from '../schemas/fieldReady.ts';
import type { ParsedContent } from './validate.ts';
import type { IssueList } from './validate.ts';

/** §124: named verticals and local services; B2B/course creators are not silently counted. */
export const BLOOMWIRED_INDUSTRIES = new Set([
  'med_spa',
  'coach',
  'consultant',
  'therapist',
  'photographer',
  'realtor',
  'gym_fitness',
  'pet_service',
  'hvac',
  'roofing',
  'cleaning',
  'remodeling',
  'dentist',
  'chiropractor',
  'law_firm',
  'accounting',
  'wedding_vendor',
]);
export function fieldReadyCoverage(content: Omit<ParsedContent, 'paths'>) {
  const campaign = content.campaigns.find((item) => item.id === 'CAMP-FIELD_READY');
  const skillIds = new Set(campaign?.gates.flatMap((gate) => gate.skills) ?? []);
  const skills = content.skills.filter((skill) => skillIds.has(skill.id));
  const units = content.learning_units.filter((unit) => unit.skills.some((id) => skillIds.has(id)));
  const exercises = content.exercises.filter((exercise) =>
    exercise.skills.some((id) => skillIds.has(id)),
  );
  const scenarioIds = new Set(
    exercises.flatMap((exercise) => (exercise.scenario ? [exercise.scenario] : [])),
  );
  const clients = new Map(content.clients.map((client) => [client.id, client]));
  const scenarios = content.scenarios
    .filter((scenario) => scenarioIds.has(scenario.id))
    .map((scenario) => ({
      id: scenario.id,
      client: scenario.client,
      industry: clients.get(scenario.client)?.industry ?? null,
      bloomwired: BLOOMWIRED_INDUSTRIES.has(clients.get(scenario.client)?.industry ?? ''),
    }));
  const topics = FIELD_READY_TOPIC_IDS.map((topic) => ({
    topic,
    units: units.filter((unit) => unit.topics.includes(topic)).map((unit) => unit.id),
    exercises: exercises
      .filter((exercise) => exercise.topics.includes(topic))
      .map((exercise) => exercise.id),
  }));
  const minutes = {
    instruction: units.reduce((sum, unit) => sum + unit.estimated_minutes, 0),
    practical: exercises
      .filter((exercise) => exercise.time_category === 'practical')
      .reduce((sum, exercise) => sum + exercise.estimated_minutes, 0),
    retrieval: exercises
      .filter((exercise) => exercise.time_category === 'retrieval')
      .reduce((sum, exercise) => sum + exercise.estimated_minutes, 0),
  };
  const total = minutes.instruction + minutes.practical + minutes.retrieval;
  const ratio = {
    instruction: total ? (minutes.instruction / total) * 100 : 0,
    practical: total ? (minutes.practical / total) * 100 : 0,
    retrieval: total ? (minutes.retrieval / total) * 100 : 0,
  };
  // ±10 percentage points, declared explicitly rather than rounded into a passing band.
  const ratio_passes =
    total > 0 &&
    Math.abs(ratio.instruction - 20) <= 10 &&
    Math.abs(ratio.practical - 60) <= 10 &&
    Math.abs(ratio.retrieval - 20) <= 10;
  const bloomwired_percent = scenarios.length
    ? (scenarios.filter((scenario) => scenario.bloomwired).length / scenarios.length) * 100
    : 0;
  return {
    campaign: campaign?.id ?? null,
    future_boundaries: campaign?.future_boundaries ?? [],
    topics,
    missing_topics: topics
      .filter((topic) => !topic.units.length || !topic.exercises.length)
      .map((topic) => topic.topic),
    identities: content.skills.map((skill) => ({ skill: skill.id, identities: skill.identities })),
    missing_identities: content.skills
      .filter((skill) => !skill.identities.length)
      .map((skill) => skill.id),
    missing_practical: skills
      .filter((skill) => !exercises.some((exercise) => exercise.skills.includes(skill.id)))
      .map((skill) => skill.id),
    minutes,
    ratio,
    ratio_tolerance_percentage_points: 10,
    ratio_passes,
    scenarios,
    bloomwired_percent,
    bloomwired_passes: bloomwired_percent >= 70,
    exercise_families: [...new Set(exercises.map((exercise) => exercise.type))].sort(),
  };
}
export type FieldReadyCoverage = ReturnType<typeof fieldReadyCoverage>;

export function validateFieldReady(content: ParsedContent, issues: IssueList): void {
  const campaign = content.campaigns.find((item) => item.id === 'CAMP-FIELD_READY');
  if (!campaign) return;
  const report = fieldReadyCoverage(content);
  const reportGap = (message: string) =>
    campaign.coverage_enforced
      ? issues.error('FIELD_READY_COVERAGE', content.paths[campaign.id] ?? null, message)
      : issues.warning('FIELD_READY_COVERAGE', content.paths[campaign.id] ?? null, message);
  if (report.missing_identities.length)
    reportGap(`Missing identities: ${report.missing_identities.join(', ')}`);
  if (report.missing_practical.length)
    reportGap(`Missing practical: ${report.missing_practical.join(', ')}`);
  if (report.missing_topics.length)
    reportGap(`Missing learn/practical coverage: ${report.missing_topics.join(', ')}`);
  if (!report.ratio_passes)
    reportGap(
      `Instruction/practical/retrieval outside 20/60/20 ±10 percentage points: ${JSON.stringify(report.ratio)}`,
    );
  if (!report.bloomwired_passes)
    reportGap(`Bloomwired scenarios: ${report.bloomwired_percent}% (minimum 70%)`);
  for (const project of content.projects.filter((row) => row.capstone || row.boss_client)) {
    const exercises = project.stages
      .flatMap((stage) => [
        ...stage.exercises,
        ...stage.conditional_exercises.flatMap((rule) => rule.exercises),
      ])
      .map((id) => content.exercises.find((row) => row.id === id))
      .filter((row) => row !== undefined);
    if (
      project.boss_client &&
      JSON.stringify(project.stages.map((stage) => stage.engagement_stage)) !==
        JSON.stringify(BOSS_STAGES)
    )
      reportGap(`${project.id}: Boss Client requires all eleven ordered engagement stages`);
    for (const stage of project.stages)
      for (const rule of stage.conditional_exercises) {
        const source = content.exercises.find((row) => row.id === rule.from_exercise);
        if (!source?.decision_options.some((option) => option.value === rule.choice))
          reportGap(`${project.id}: consequence refers to an unauthored decision choice`);
      }
    if (!project.capstone) continue;
    if (new Set(project.inputs.map((input) => input.category)).size !== CAPSTONE_INPUTS.length)
      reportGap(`${project.id}: capstone requires all nine input categories`);
    if (
      CAPSTONE_ACTIONS.some(
        (action) => !project.stages.some((stage) => stage.actions.includes(action)),
      )
    )
      reportGap(`${project.id}: capstone requires all nine actions`);
    if (
      project.reasoning_questions.length !== 8 ||
      !exercises.some((exercise) =>
        project.reasoning_questions.every((question) =>
          exercise.written_fields.some((field) => field.label === question),
        ),
      )
    )
      reportGap(`${project.id}: all eight reasoning questions require a submission exercise`);
    if (
      !project.fieldwork_required ||
      !exercises.some((exercise) => exercise.type === 'FIELDWORK' && exercise.fieldwork?.proof)
    )
      reportGap(`${project.id}: capstone requires manual real-GHL proof`);
    if (
      exercises.some(
        (exercise) =>
          exercise.hints.length ||
          !['independent', 'pressure'].includes(exercise.mode) ||
          (exercise.call?.anchors.length ?? 0) > 0,
      )
    )
      reportGap(
        `${project.id}: capstone work must be independent with no normal hints or call anchors`,
      );
  }
  const features = new Map(content.ghl_features.map((feature) => [feature.id, feature]));
  const checkFeatures = (id: string, references: string[]) => {
    for (const featureId of references)
      if (features.get(featureId)?.status !== 'current') {
        issues.error(
          'FIELD_READY_GHL_CURRENT',
          content.paths[id] ?? null,
          `${id}: ${featureId} must be current for Field Ready Funnel Builder instruction`,
        );
      }
  };
  for (const unit of content.learning_units)
    if (unit.topics.includes('conversion.funnel_builder'))
      checkFeatures(unit.id, unit.ghl_features);
  for (const exercise of content.exercises)
    if (exercise.topics.includes('conversion.funnel_builder'))
      checkFeatures(exercise.id, exercise.allowed_features);
}

import type { CampaignPath, ContentIndexes, SearchEntry, SkillGraph } from '../bundle.ts';
import { SIMULATOR_EXERCISE_TYPES } from '../schemas/index.ts';
import type { ParsedContent } from './validate.ts';

function push(map: Record<string, string[]>, key: string, value: string): void {
  const list = (map[key] ??= []);
  if (!list.includes(value)) list.push(value);
}

function sortAll(map: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.keys(map)
      .sort()
      .map((key) => [key, [...(map[key] ?? [])].sort()]),
  );
}

/** Stage 3: relationship indexes the app reads instead of scanning lists. */
export function buildIndexes(parsed: ParsedContent): ContentIndexes {
  const indexes: ContentIndexes = {
    exercises_by_skill: {},
    units_by_skill: {},
    features_by_skill: {},
    skills_by_feature: {},
    exercises_by_feature: {},
    exercises_by_scenario: {},
    scenarios_by_client: {},
    exercises_by_client: {},
    projects_by_client: {},
    campaigns_by_skill: {},
  };
  const scenarioClient = new Map(parsed.scenarios.map((s) => [s.id, s.client]));

  for (const skill of parsed.skills) {
    for (const feature of skill.ghl_features) {
      push(indexes.features_by_skill, skill.id, feature);
      push(indexes.skills_by_feature, feature, skill.id);
    }
  }
  for (const feature of parsed.ghl_features) {
    for (const skill of feature.skills) {
      push(indexes.features_by_skill, skill, feature.id);
      push(indexes.skills_by_feature, feature.id, skill);
    }
  }
  for (const unit of parsed.learning_units) {
    for (const skill of unit.skills) push(indexes.units_by_skill, skill, unit.id);
  }
  for (const exercise of parsed.exercises) {
    for (const skill of exercise.skills) push(indexes.exercises_by_skill, skill, exercise.id);
    for (const feature of exercise.allowed_features)
      push(indexes.exercises_by_feature, feature, exercise.id);
    for (const workflow of exercise.starting_state.workflows) {
      push(indexes.exercises_by_feature, workflow.trigger.ghl_feature_id, exercise.id);
      for (const node of workflow.nodes)
        if (node.ghl_feature_id)
          push(indexes.exercises_by_feature, node.ghl_feature_id, exercise.id);
    }
    if (exercise.scenario) push(indexes.exercises_by_scenario, exercise.scenario, exercise.id);
    const client =
      exercise.client ?? (exercise.scenario ? scenarioClient.get(exercise.scenario) : undefined);
    if (client) push(indexes.exercises_by_client, client, exercise.id);
    for (const prospect of exercise.prospects)
      push(indexes.exercises_by_client, prospect, exercise.id);
  }
  for (const scenario of parsed.scenarios)
    push(indexes.scenarios_by_client, scenario.client, scenario.id);
  for (const project of parsed.projects)
    push(indexes.projects_by_client, project.client, project.id);
  for (const campaign of parsed.campaigns) {
    for (const gate of campaign.gates)
      for (const skill of gate.skills) push(indexes.campaigns_by_skill, skill, campaign.id);
  }

  return Object.fromEntries(
    Object.entries(indexes).map(([key, map]) => [key, sortAll(map)]),
  ) as unknown as ContentIndexes;
}

/** Stage 3: each campaign as an ordered path through the graph (spec §10). */
export function buildCampaignPaths(parsed: ParsedContent, graph: SkillGraph): CampaignPath[] {
  const position = new Map(graph.order.map((id, index) => [id, index]));
  const byId = new Map(parsed.campaigns.map((c) => [c.id, c]));
  return parsed.campaigns.map((campaign) => {
    const inherited = new Set<string>();
    for (const ref of campaign.requires_campaigns) {
      for (const gate of byId.get(ref)?.gates ?? []) gate.skills.forEach((s) => inherited.add(s));
    }
    const gates = campaign.gates.map((gate) => ({
      gate: gate.id,
      number: gate.number,
      name: gate.name,
      skills: [...gate.skills].sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0)),
      assesses: [...gate.assesses],
      projects: [...gate.projects],
    }));
    return {
      campaign: campaign.id,
      gates,
      ordered_skills: gates.flatMap((gate) => gate.skills),
      inherited_skills: [...inherited].sort(),
    };
  });
}

/** Stage 3: a flat search index over every record (INF-017 consumes it later). */
export function buildSearchIndex(parsed: ParsedContent): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const s of parsed.skills)
    entries.push({
      type: 'skills',
      id: s.id,
      title: s.title,
      keywords: [s.territory, s.tier, ...s.keywords],
    });
  for (const f of parsed.ghl_features)
    entries.push({
      type: 'ghl-features',
      id: f.id,
      title: f.official_name,
      keywords: [f.area, f.feature_type, ...f.aliases],
    });
  for (const c of parsed.campaigns)
    entries.push({ type: 'campaigns', id: c.id, title: c.title, keywords: [] });
  for (const u of parsed.learning_units)
    entries.push({
      type: 'learning-units',
      id: u.id,
      title: u.title,
      keywords: u.headings.map((h) => h.text),
    });
  for (const e of parsed.exercises)
    entries.push({ type: 'exercises', id: e.id, title: e.title, keywords: [e.type, e.mode] });
  for (const s of parsed.scenarios)
    entries.push({ type: 'scenarios', id: s.id, title: s.title, keywords: [s.client] });
  for (const c of parsed.clients)
    entries.push({ type: 'clients', id: c.id, title: c.business_name, keywords: [c.industry] });
  for (const r of parsed.rubrics)
    entries.push({ type: 'rubrics', id: r.id, title: r.title, keywords: r.applies_to });
  for (const p of parsed.projects)
    entries.push({ type: 'projects', id: p.id, title: p.title, keywords: [p.tier] });
  for (const p of parsed.portfolio)
    entries.push({ type: 'portfolio', id: p.id, title: p.title, keywords: [p.label] });
  for (const g of parsed.glossary)
    entries.push({ type: 'glossary', id: g.id, title: g.term, keywords: g.aliases });
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

export function isSimulatorExercise(type: string): boolean {
  return (SIMULATOR_EXERCISE_TYPES as readonly string[]).includes(type);
}

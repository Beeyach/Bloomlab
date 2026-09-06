import type { ZodType } from 'zod';

import {
  initialAccount,
  validateWorkflowGraph,
  type SimulatorScenario,
} from '@bloomlab/simulator-core';

import type { ContentIssue, IssueCode } from '../bundle.ts';
import { CONTENT_TYPES, type ContentType, territoryOfSkillId } from '../ids.ts';
import {
  CampaignSchema,
  ClientSchema,
  ExerciseSchema,
  GhlFeatureSchema,
  GlossarySchema,
  LearningUnitFrontMatterSchema,
  PortfolioSchema,
  ProjectSchema,
  RubricSchema,
  ScenarioSchema,
  SIMULATOR_EXERCISE_TYPES,
  SkillSchema,
  type Campaign,
  type Client,
  type Exercise,
  type GhlFeature,
  type GlossaryEntry,
  type LearningUnit,
  type Portfolio,
  type Project,
  type Rubric,
  type Scenario,
  type Skill,
  type WorkflowDefinition,
} from '../schemas/index.ts';
import { buildSkillGraph, transitivePrerequisites, type GraphResult } from './graph.ts';
import {
  DIAGRAM_KINDS,
  EMBED_KIND_ATTRIBUTES,
  INTERACTIVE_KINDS,
  type DiagramKind,
  type InteractiveKind,
} from '../schemas/learningUnit.ts';
import { isKnownEmbed, parseMdxBody, parseYamlObject, splitFrontMatter } from './parse.ts';
import type { SourceFile } from './sources.ts';

/** Everything parsed and schema-valid, before cross-reference checks. */
export interface ParsedContent {
  skills: Skill[];
  ghl_features: GhlFeature[];
  campaigns: Campaign[];
  learning_units: LearningUnit[];
  exercises: Exercise[];
  scenarios: Scenario[];
  clients: Client[];
  rubrics: Rubric[];
  projects: Project[];
  portfolio: Portfolio[];
  glossary: GlossaryEntry[];
  /** Source path per record ID, for issue reporting. */
  paths: Record<string, string>;
}

const YAML_SCHEMAS: Record<Exclude<ContentType, 'learning-units'>, ZodType> = {
  skills: SkillSchema,
  'ghl-features': GhlFeatureSchema,
  campaigns: CampaignSchema,
  exercises: ExerciseSchema,
  scenarios: ScenarioSchema,
  clients: ClientSchema,
  rubrics: RubricSchema,
  projects: ProjectSchema,
  portfolio: PortfolioSchema,
  glossary: GlossarySchema,
};

const KEY_OF_TYPE: Record<ContentType, keyof Omit<ParsedContent, 'paths'>> = {
  skills: 'skills',
  'ghl-features': 'ghl_features',
  campaigns: 'campaigns',
  'learning-units': 'learning_units',
  exercises: 'exercises',
  scenarios: 'scenarios',
  clients: 'clients',
  rubrics: 'rubrics',
  projects: 'projects',
  portfolio: 'portfolio',
  glossary: 'glossary',
};

export class IssueList {
  readonly issues: ContentIssue[] = [];

  error(
    code: IssueCode,
    file: string | null,
    message: string,
    extra: { id?: string; path?: string } = {},
  ): void {
    this.issues.push({ level: 'error', code, file, message, ...extra });
  }

  warning(
    code: IssueCode,
    file: string | null,
    message: string,
    extra: { id?: string; path?: string } = {},
  ): void {
    this.issues.push({ level: 'warning', code, file, message, ...extra });
  }

  get errors(): ContentIssue[] {
    return this.issues.filter((issue) => issue.level === 'error');
  }

  get warnings(): ContentIssue[] {
    return this.issues.filter((issue) => issue.level === 'warning');
  }
}

function emptyParsed(): ParsedContent {
  return {
    skills: [],
    ghl_features: [],
    campaigns: [],
    learning_units: [],
    exercises: [],
    scenarios: [],
    clients: [],
    rubrics: [],
    projects: [],
    portfolio: [],
    glossary: [],
    paths: {},
  };
}

/** Stage 1: parse every file and validate it against its schema. Duplicate IDs are caught here. */
export async function parseAndValidateFiles(
  files: readonly SourceFile[],
  issues: IssueList,
): Promise<ParsedContent> {
  const parsed = emptyParsed();
  const seen = new Map<string, string>();

  for (const file of files) {
    let record: { id: unknown };
    let unit: LearningUnit | null = null;
    try {
      if (file.type === 'learning-units') {
        const split = splitFrontMatter(file.text);
        if (!split)
          throw new Error('Learning units start with YAML front matter between --- lines');
        const front = parseYamlObject(split.frontMatter, file.path);
        const result = LearningUnitFrontMatterSchema.safeParse(front);
        if (!result.success) {
          for (const issue of result.error.issues) {
            issues.error('SCHEMA', file.path, issue.message, { path: issue.path.join('.') });
          }
          continue;
        }
        let body;
        try {
          body = await parseMdxBody(split.body);
        } catch (error) {
          issues.error(
            'MDX_SYNTAX',
            file.path,
            error instanceof Error ? error.message : String(error),
            {
              id: result.data.id,
            },
          );
          continue;
        }
        unit = { ...result.data, body_mdx: split.body, ...body };
        record = unit;
      } else {
        const value = parseYamlObject(file.text, file.path);
        const result = YAML_SCHEMAS[file.type].safeParse(value);
        if (!result.success) {
          for (const issue of result.error.issues) {
            issues.error('SCHEMA', file.path, issue.message, {
              path: issue.path.map(String).join('.'),
              ...(typeof value.id === 'string' ? { id: value.id } : {}),
            });
          }
          continue;
        }
        record = result.data as { id: unknown };
      }
    } catch (error) {
      issues.error(
        'PARSE_ERROR',
        file.path,
        error instanceof Error ? error.message : String(error),
      );
      continue;
    }

    const id = String(record.id);
    if (id !== file.stem) {
      issues.error(
        'ID_MISMATCH',
        file.path,
        `File name "${file.stem}" must equal the record id "${id}"`,
        { id },
      );
      continue;
    }
    const previous = seen.get(id);
    if (previous) {
      issues.error('DUPLICATE_ID', file.path, `Duplicate id ${id} (also in ${previous})`, { id });
      continue;
    }
    seen.set(id, file.path);
    parsed.paths[id] = file.path;
    (parsed[KEY_OF_TYPE[file.type]] as unknown[]).push(unit ?? record);
  }

  for (const key of CONTENT_TYPES) {
    const list = parsed[KEY_OF_TYPE[key]] as { id: string }[];
    list.sort((a, b) => a.id.localeCompare(b.id));
  }
  return parsed;
}

interface Lookup {
  skills: Map<string, Skill>;
  features: Map<string, GhlFeature>;
  campaigns: Map<string, Campaign>;
  units: Map<string, LearningUnit>;
  exercises: Map<string, Exercise>;
  scenarios: Map<string, Scenario>;
  clients: Map<string, Client>;
  rubrics: Map<string, Rubric>;
  projects: Map<string, Project>;
  portfolio: Map<string, Portfolio>;
}

function lookupOf(parsed: ParsedContent): Lookup {
  const index = <T extends { id: string }>(list: T[]) =>
    new Map(list.map((item) => [item.id, item]));
  return {
    skills: index(parsed.skills),
    features: index(parsed.ghl_features),
    campaigns: index(parsed.campaigns),
    units: index(parsed.learning_units),
    exercises: index(parsed.exercises),
    scenarios: index(parsed.scenarios),
    clients: index(parsed.clients),
    rubrics: index(parsed.rubrics),
    projects: index(parsed.projects),
    portfolio: index(parsed.portfolio),
  };
}

/** Stage 2: every reference resolves, graphs are acyclic, semantics hold. Returns the graph. */
export function crossValidate(parsed: ParsedContent, issues: IssueList): GraphResult {
  const look = lookupOf(parsed);
  const fileOf = (id: string) => parsed.paths[id] ?? null;

  const requireRef = (
    code: IssueCode,
    map: ReadonlyMap<string, unknown>,
    ref: string,
    owner: { id: string },
    path: string,
    what: string,
  ): boolean => {
    if (map.has(ref)) return true;
    issues.error(code, fileOf(owner.id), `${owner.id} references unknown ${what} ${ref}`, {
      id: owner.id,
      path,
    });
    return false;
  };
  const requireSkill = (ref: string, owner: { id: string }, path: string) =>
    requireRef('MISSING_SKILL', look.skills, ref, owner, path, 'skill');
  const requireFeature = (ref: string, owner: { id: string }, path: string) =>
    requireRef('MISSING_GHL_FEATURE', look.features, ref, owner, path, 'GHL feature');

  /** Checks a feature reference's status; `simulated` means it will run inside the simulator. */
  const checkFeatureUse = (
    ref: string,
    owner: { id: string },
    path: string,
    simulated: boolean,
  ) => {
    const feature = look.features.get(ref);
    if (!feature) return;
    if (feature.status === 'removed') {
      issues.error(
        'REMOVED_FEATURE_REFERENCED',
        fileOf(owner.id),
        `${owner.id} uses removed feature ${ref}`,
        {
          id: owner.id,
          path,
        },
      );
    } else if (feature.status === 'deprecated') {
      issues.warning(
        'DEPRECATED_FEATURE_USED',
        fileOf(owner.id),
        `${owner.id} uses deprecated feature ${ref}`,
        {
          id: owner.id,
          path,
        },
      );
    }
    if (!simulated) return;
    if (feature.simulation_fidelity === 'REAL_GHL') {
      issues.error(
        'REAL_GHL_AS_SIMULATOR_ACTION',
        fileOf(owner.id),
        `${owner.id} would simulate ${ref}, which is REAL_GHL (not simulated; learners practise it in real GHL)`,
        { id: owner.id, path },
      );
    }
    if (feature.status === 'needs_review') {
      issues.warning(
        'FEATURE_NEEDS_REVIEW_USED',
        fileOf(owner.id),
        `${owner.id} simulates ${ref}, whose registry record still needs review`,
        { id: owner.id, path },
      );
    }
  };

  const checkWorkflow = (workflow: WorkflowDefinition, owner: { id: string }, basePath: string) => {
    if (requireFeature(workflow.trigger.ghl_feature_id, owner, `${basePath}.trigger`)) {
      checkFeatureUse(workflow.trigger.ghl_feature_id, owner, `${basePath}.trigger`, true);
      const feature = look.features.get(workflow.trigger.ghl_feature_id);
      if (feature && feature.feature_type !== 'trigger') {
        issues.error(
          'FEATURE_TYPE_MISMATCH',
          fileOf(owner.id),
          `${owner.id}: workflow ${workflow.id} triggers on ${feature.id}, which is a ${feature.feature_type}, not a trigger`,
          { id: owner.id, path: `${basePath}.trigger` },
        );
      }
    }
    workflow.nodes.forEach((node, index) => {
      if (!node.ghl_feature_id) return;
      const path = `${basePath}.nodes.${index}`;
      if (!requireFeature(node.ghl_feature_id, owner, path)) return;
      checkFeatureUse(node.ghl_feature_id, owner, path, true);
      const feature = look.features.get(node.ghl_feature_id);
      if (feature && feature.feature_type !== 'action') {
        issues.error(
          'FEATURE_TYPE_MISMATCH',
          fileOf(owner.id),
          `${owner.id}: workflow node ${node.id} uses ${feature.id}, which is a ${feature.feature_type}, not an action`,
          { id: owner.id, path },
        );
      }
    });
  };

  // ---- skills
  for (const skill of parsed.skills) {
    const territory = territoryOfSkillId(skill.id);
    if (territory && territory !== skill.territory) {
      issues.error(
        'TERRITORY_MISMATCH',
        fileOf(skill.id),
        `${skill.id} declares territory ${skill.territory}`,
        {
          id: skill.id,
          path: 'territory',
        },
      );
    }
    skill.prerequisites.forEach((prerequisite, index) => {
      requireRef(
        'MISSING_PREREQUISITE',
        look.skills,
        prerequisite,
        skill,
        `prerequisites.${index}`,
        'prerequisite skill',
      );
    });
    skill.ghl_features.forEach((feature, index) => {
      if (requireFeature(feature, skill, `ghl_features.${index}`))
        checkFeatureUse(feature, skill, `ghl_features.${index}`, false);
    });
  }
  const graphResult = buildSkillGraph(parsed.skills);
  for (const id of graphResult.cyclic) {
    issues.error('PREREQUISITE_CYCLE', fileOf(id), `${id} is part of a prerequisite cycle`, {
      id,
      path: 'prerequisites',
    });
  }

  // ---- registry
  for (const feature of parsed.ghl_features) {
    feature.skills.forEach((skill, index) => requireSkill(skill, feature, `skills.${index}`));
    if (feature.replaced_by) requireFeature(feature.replaced_by, feature, 'replaced_by');
  }

  // ---- campaigns
  for (const campaign of parsed.campaigns) {
    campaign.requires_campaigns.forEach((ref, index) =>
      requireRef(
        'MISSING_CAMPAIGN',
        look.campaigns,
        ref,
        campaign,
        `requires_campaigns.${index}`,
        'campaign',
      ),
    );
    const inherited = new Set<string>();
    for (const ref of campaign.requires_campaigns) {
      for (const gate of look.campaigns.get(ref)?.gates ?? [])
        gate.skills.forEach((s) => inherited.add(s));
    }
    const gateOfSkill = new Map<string, number>();
    campaign.gates.forEach((gate, gateIndex) => {
      gate.skills.forEach((skill, index) => {
        if (requireSkill(skill, campaign, `gates.${gateIndex}.skills.${index}`))
          gateOfSkill.set(skill, gateIndex);
      });
      gate.projects.forEach((project, index) =>
        requireRef(
          'MISSING_PROJECT',
          look.projects,
          project,
          campaign,
          `gates.${gateIndex}.projects.${index}`,
          'project',
        ),
      );
    });
    campaign.gates.forEach((gate, gateIndex) => {
      gate.assesses.forEach((skill, index) => {
        if (!requireSkill(skill, campaign, `gates.${gateIndex}.assesses.${index}`)) return;
        if (!gateOfSkill.has(skill)) {
          issues.error(
            'ASSESSES_NOT_IN_CAMPAIGN',
            fileOf(campaign.id),
            `${campaign.id}: ${gate.id} assesses ${skill}, which no gate of this campaign trains`,
            { id: campaign.id, path: `gates.${gateIndex}.assesses.${index}` },
          );
        }
      });
      gate.skills.forEach((skillId, index) => {
        const skill = look.skills.get(skillId);
        if (!skill) return;
        for (const prerequisite of skill.prerequisites) {
          if (!look.skills.has(prerequisite)) continue;
          const path = `gates.${gateIndex}.skills.${index}`;
          const prerequisiteGate = gateOfSkill.get(prerequisite);
          if (prerequisiteGate === undefined) {
            if (!inherited.has(prerequisite)) {
              issues.error(
                'CAMPAIGN_MISSING_PREREQUISITE',
                fileOf(campaign.id),
                `${campaign.id}: ${skillId} (${gate.id}) requires ${prerequisite}, which this campaign never trains`,
                { id: campaign.id, path },
              );
            }
          } else if (prerequisiteGate > gateIndex) {
            issues.error(
              'CAMPAIGN_PREREQUISITE_ORDER',
              fileOf(campaign.id),
              `${campaign.id}: ${skillId} (${gate.id}) requires ${prerequisite}, taught later in ${campaign.gates[prerequisiteGate]?.id}`,
              { id: campaign.id, path },
            );
          }
        }
      });
      if (!gate.placement && gate.skills.length === 0) {
        issues.warning(
          'GATE_WITHOUT_SKILLS',
          fileOf(campaign.id),
          `${campaign.id}: ${gate.id} (${gate.name}) has no authored skills yet`,
          {
            id: campaign.id,
            path: `gates.${gateIndex}.skills`,
          },
        );
      }
      if (!gate.placement && gate.projects.length === 0 && gate.number >= 2) {
        issues.warning(
          'GATE_WITHOUT_PROJECT',
          fileOf(campaign.id),
          `${campaign.id}: ${gate.id} has no project yet`,
          {
            id: campaign.id,
            path: `gates.${gateIndex}.projects`,
          },
        );
      }
    });
  }

  // ---- learning units
  for (const unit of parsed.learning_units) {
    unit.skills.forEach((skill, index) => requireSkill(skill, unit, `skills.${index}`));
    unit.ghl_features.forEach((feature, index) => {
      if (requireFeature(feature, unit, `ghl_features.${index}`))
        checkFeatureUse(feature, unit, `ghl_features.${index}`, false);
    });
    unit.embeds.forEach((embed) => {
      const where = `body line ${embed.line}`;
      if (!isKnownEmbed(embed.component)) {
        issues.error(
          'UNKNOWN_EMBED',
          fileOf(unit.id),
          `${unit.id} embeds <${embed.component}>, which is not an Academy component`,
          {
            id: unit.id,
            path: where,
          },
        );
        return;
      }
      const need = (attribute: string): string | null => {
        const value = embed.attributes[attribute];
        if (value) return value;
        issues.error(
          'EMBED_MISSING_ATTRIBUTE',
          fileOf(unit.id),
          `${unit.id}: <${embed.component}> needs ${attribute}=…`,
          {
            id: unit.id,
            path: where,
          },
        );
        return null;
      };
      switch (embed.component) {
        case 'Simulation': {
          const scenario = need('scenario');
          if (scenario)
            requireRef('MISSING_SCENARIO', look.scenarios, scenario, unit, where, 'scenario');
          break;
        }
        case 'Exercise': {
          const exercise = need('id');
          if (exercise)
            requireRef('MISSING_EXERCISE', look.exercises, exercise, unit, where, 'exercise');
          break;
        }
        case 'Feature': {
          const feature = need('id');
          if (feature && requireFeature(feature, unit, where))
            checkFeatureUse(feature, unit, where, false);
          break;
        }
        case 'Depth':
          need('title');
          break;
        case 'Callout':
          break;
        case 'Diagram':
        case 'Interactive': {
          const kinds: readonly string[] =
            embed.component === 'Diagram' ? DIAGRAM_KINDS : INTERACTIVE_KINDS;
          const kind = need('kind');
          if (kind && !kinds.includes(kind)) {
            issues.error(
              'UNKNOWN_EMBED',
              fileOf(unit.id),
              `${unit.id}: <${embed.component} kind="${kind}"> is not a kind Bloomlab renders (${kinds.join(', ')})`,
              { id: unit.id, path: where },
            );
            break;
          }
          if (kind) {
            for (const attribute of EMBED_KIND_ATTRIBUTES[kind as DiagramKind | InteractiveKind]) {
              const value = need(attribute);
              if (
                value &&
                attribute !== 'scenario' &&
                attribute !== 'workflow' &&
                Number.isNaN(Number(value))
              ) {
                issues.error(
                  'EMBED_MISSING_ATTRIBUTE',
                  fileOf(unit.id),
                  `${unit.id}: <${embed.component}> ${attribute}="${value}" must be a number`,
                  { id: unit.id, path: where },
                );
              }
            }
            if (kind === 'workflow') {
              const scenario = embed.attributes.scenario;
              if (
                scenario &&
                requireRef('MISSING_SCENARIO', look.scenarios, scenario, unit, where, 'scenario')
              ) {
                const workflow = embed.attributes.workflow;
                const known = look.scenarios
                  .get(scenario)
                  ?.initial_account_state.workflows.some((w) => w.id === workflow);
                if (!known)
                  issues.error(
                    'MISSING_WORKFLOW',
                    fileOf(unit.id),
                    `${unit.id}: scenario ${scenario} has no workflow ${workflow}`,
                    { id: unit.id, path: where },
                  );
              }
            }
          }
          break;
        }
      }
    });
    if (
      !unit.embeds.some(
        (embed) =>
          embed.component === 'Simulation' ||
          embed.component === 'Exercise' ||
          embed.component === 'Interactive',
      )
    ) {
      issues.warning(
        'UNIT_NO_EMBEDS',
        fileOf(unit.id),
        `${unit.id} has no inline simulation or exercise (passive reading)`,
        {
          id: unit.id,
        },
      );
    }
  }

  // ---- exercises
  for (const exercise of parsed.exercises) {
    const simulated = SIMULATOR_EXERCISE_TYPES.includes(exercise.type);
    exercise.skills.forEach((skill, index) => requireSkill(skill, exercise, `skills.${index}`));
    let scenario: Scenario | undefined;
    if (
      exercise.scenario &&
      requireRef(
        'MISSING_SCENARIO',
        look.scenarios,
        exercise.scenario,
        exercise,
        'scenario',
        'scenario',
      )
    ) {
      scenario = look.scenarios.get(exercise.scenario);
    }
    if (exercise.client) {
      requireRef('MISSING_CLIENT', look.clients, exercise.client, exercise, 'client', 'client');
      if (scenario && scenario.client !== exercise.client) {
        issues.error(
          'SCENARIO_CLIENT_MISMATCH',
          fileOf(exercise.id),
          `${exercise.id} names client ${exercise.client} but scenario ${scenario.id} belongs to ${scenario.client}`,
          { id: exercise.id, path: 'client' },
        );
      }
    }
    exercise.prospects.forEach((client, index) =>
      requireRef('MISSING_CLIENT', look.clients, client, exercise, `prospects.${index}`, 'client'),
    );
    exercise.allowed_features.forEach((feature, index) => {
      if (requireFeature(feature, exercise, `allowed_features.${index}`)) {
        checkFeatureUse(feature, exercise, `allowed_features.${index}`, simulated);
      }
    });
    [...exercise.expected_outcomes, ...exercise.critical_failures].forEach((assertion) => {
      if (assertion.type === 'architecture' && assertion.ghl_feature) {
        requireFeature(assertion.ghl_feature, exercise, `assertion ${assertion.id}`);
      }
    });
    exercise.starting_state.workflows.forEach((workflow, index) =>
      checkWorkflow(workflow, exercise, `starting_state.workflows.${index}`),
    );
    if (
      exercise.grading.rubric &&
      requireRef(
        'MISSING_RUBRIC',
        look.rubrics,
        exercise.grading.rubric,
        exercise,
        'grading.rubric',
        'rubric',
      )
    ) {
      const rubric = look.rubrics.get(exercise.grading.rubric);
      if (rubric && !rubric.applies_to.includes(exercise.type)) {
        issues.error(
          'RUBRIC_TYPE_MISMATCH',
          fileOf(exercise.id),
          `${exercise.id} (${exercise.type}) uses ${rubric.id}, which applies to ${rubric.applies_to.join(', ')}`,
          { id: exercise.id, path: 'grading.rubric' },
        );
      }
    }
    if (exercise.portfolio)
      requireRef(
        'MISSING_PORTFOLIO',
        look.portfolio,
        exercise.portfolio,
        exercise,
        'portfolio',
        'portfolio item',
      );
    if (exercise.conversation?.client) {
      requireRef(
        'MISSING_CLIENT',
        look.clients,
        exercise.conversation.client,
        exercise,
        'conversation.client',
        'client',
      );
    }
    // A sales exercise is only honest if the learner's evidence is what a learner could see. A
    // hidden fact copied into the evidence pack, a client's message or the brief hands over
    // something nobody observed and turns an audit into a memory test (SAL-001, §23, §35).
    const secrets: string[] = [];
    const collect = (facts: Record<string, string | number | boolean>) => {
      for (const value of Object.values(facts)) {
        if (typeof value === 'string' && value.trim().length >= 8) secrets.push(value.trim());
      }
    };
    if (scenario) collect(scenario.hidden_facts);
    for (const id of [exercise.client, exercise.conversation?.client, ...exercise.prospects]) {
      const client = id ? look.clients.get(id) : undefined;
      if (client) collect(client.hidden_facts);
    }
    const visible: { where: string; text: string }[] = [
      { where: 'instructions', text: exercise.instructions },
      ...exercise.sales.evidence.map((item, index) => ({
        where: `sales.evidence.${index}.observation`,
        text: item.observation,
      })),
      ...exercise.written_fields.map((field, index) => ({
        where: `written_fields.${index}.help`,
        text: `${field.label} ${field.help}`,
      })),
      ...exercise.hints.map((hint, index) => ({ where: `hints.${index}`, text: hint.text })),
      ...(exercise.conversation?.nodes ?? []).map((node, index) => ({
        where: `conversation.nodes.${index}.client_message`,
        text: `${node.client_message} ${node.moves.map((move) => move.label).join(' ')}`,
      })),
    ];
    for (const { where, text } of visible) {
      const lowered = text.toLowerCase();
      for (const secret of secrets) {
        if (lowered.includes(secret.toLowerCase())) {
          issues.error(
            'HIDDEN_FACT_EXPOSED',
            fileOf(exercise.id),
            `${exercise.id} shows the learner a hidden fact ("${secret}") in ${where}`,
            { id: exercise.id, path: where },
          );
        }
      }
    }
  }

  // ---- scenarios
  for (const scenario of parsed.scenarios) {
    requireRef('MISSING_CLIENT', look.clients, scenario.client, scenario, 'client', 'client');
    scenario.initial_account_state.workflows.forEach((workflow, index) =>
      checkWorkflow(workflow, scenario, `initial_account_state.workflows.${index}`),
    );
    // An authored workflow must be one the engine will run: the same graph validation the
    // Workflow Lab applies before a test contact enters, applied at compile time against the
    // account the scenario itself builds (WFL-003). A scenario that authors a broken workflow on
    // purpose has no way to say so yet; when one does, it will need a flag here, not a bypass.
    try {
      const account = initialAccount(scenario as unknown as SimulatorScenario);
      for (const workflow of Object.values(account.workflows)) {
        for (const problem of validateWorkflowGraph(workflow, account)) {
          issues.error(
            'WORKFLOW_GRAPH_INVALID',
            fileOf(scenario.id),
            `${scenario.id}: workflow ${workflow.id}${problem.node_id ? ` step ${problem.node_id}` : ''} — ${problem.message} (${problem.code})`,
            { id: scenario.id, path: `initial_account_state.workflows.${workflow.id}` },
          );
        }
      }
    } catch (error) {
      issues.error(
        'WORKFLOW_GRAPH_INVALID',
        fileOf(scenario.id),
        `${scenario.id}: the simulator cannot build this account — ${error instanceof Error ? error.message : String(error)}`,
        { id: scenario.id, path: 'initial_account_state' },
      );
    }
  }

  // ---- projects and portfolio
  for (const project of parsed.projects) {
    requireRef('MISSING_CLIENT', look.clients, project.client, project, 'client', 'client');
    project.skills.forEach((skill, index) => requireSkill(skill, project, `skills.${index}`));
    project.stages.forEach((stage, stageIndex) =>
      stage.exercises.forEach((exercise, index) =>
        requireRef(
          'MISSING_EXERCISE',
          look.exercises,
          exercise,
          project,
          `stages.${stageIndex}.exercises.${index}`,
          'exercise',
        ),
      ),
    );
    if (
      project.portfolio &&
      requireRef(
        'MISSING_PORTFOLIO',
        look.portfolio,
        project.portfolio,
        project,
        'portfolio',
        'portfolio item',
      )
    ) {
      const item = look.portfolio.get(project.portfolio);
      if (item && item.project !== project.id) {
        issues.error(
          'PORTFOLIO_PROJECT_MISMATCH',
          fileOf(project.id),
          `${project.id} points at ${item.id}, which belongs to project ${item.project}`,
          { id: project.id, path: 'portfolio' },
        );
      }
    }
  }
  const progression = new Map<number, string>();
  for (const item of parsed.portfolio) {
    requireRef('MISSING_PROJECT', look.projects, item.project, item, 'project', 'project');
    const other = progression.get(item.progression_number);
    if (other) {
      issues.error(
        'DUPLICATE_PROGRESSION_NUMBER',
        fileOf(item.id),
        `${item.id} and ${other} both claim portfolio position ${item.progression_number}`,
        { id: item.id, path: 'progression_number' },
      );
    }
    progression.set(item.progression_number, item.id);
  }

  // ---- glossary
  for (const entry of parsed.glossary) {
    entry.related_skills.forEach((skill, index) =>
      requireSkill(skill, entry, `related_skills.${index}`),
    );
    entry.ghl_features.forEach((feature, index) =>
      requireFeature(feature, entry, `ghl_features.${index}`),
    );
  }

  // ---- graph-level warnings (only meaningful when the graph is intact)
  if (issues.errors.length === 0) {
    const inCampaign = new Set(parsed.campaigns.flatMap((c) => c.gates.flatMap((g) => g.skills)));
    const withUnit = new Set(parsed.learning_units.flatMap((u) => u.skills));
    const withExercise = new Set(parsed.exercises.flatMap((e) => e.skills));
    for (const skill of parsed.skills) {
      if (!inCampaign.has(skill.id))
        issues.warning('ORPHAN_SKILL', fileOf(skill.id), `${skill.id} is in no campaign`, {
          id: skill.id,
        });
      if (!withUnit.has(skill.id))
        issues.warning('SKILL_NO_UNIT', fileOf(skill.id), `${skill.id} has no learning unit`, {
          id: skill.id,
        });
      if (!withExercise.has(skill.id))
        issues.warning('SKILL_NO_PRACTICE', fileOf(skill.id), `${skill.id} has no exercise`, {
          id: skill.id,
        });
    }
  }

  return graphResult;
}

/** Utility for callers that need the transitive closure (campaign path resolution). */
export { transitivePrerequisites };

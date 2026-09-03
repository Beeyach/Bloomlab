import { TERRITORIES, type Territory } from '../ids.ts';
import type { Skill } from '../schemas/index.ts';
import type { SkillGraph } from '../bundle.ts';

export interface GraphResult {
  graph: SkillGraph;
  /** Skill IDs that sit on at least one prerequisite cycle. */
  cyclic: string[];
}

/**
 * Prerequisite graph: topological order (Kahn), depth (longest chain), dependents, and the
 * set of skills caught in a cycle. Missing prerequisites are reported elsewhere and ignored here.
 */
export function buildSkillGraph(skills: readonly Skill[]): GraphResult {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const skill of skills) {
    indegree.set(skill.id, 0);
    dependents.set(skill.id, []);
  }
  for (const skill of skills) {
    for (const prerequisite of skill.prerequisites) {
      if (!byId.has(prerequisite)) continue;
      indegree.set(skill.id, (indegree.get(skill.id) ?? 0) + 1);
      dependents.get(prerequisite)?.push(skill.id);
    }
  }

  const order: string[] = [];
  const depth: Record<string, number> = {};
  const queue = skills
    .filter((skill) => (indegree.get(skill.id) ?? 0) === 0)
    .map((skill) => skill.id)
    .sort();
  for (const id of queue) depth[id] = 0;
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const dependent of [...(dependents.get(id) ?? [])].sort()) {
      depth[dependent] = Math.max(depth[dependent] ?? 0, (depth[id] ?? 0) + 1);
      const remaining = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, remaining);
      if (remaining === 0) {
        queue.push(dependent);
        queue.sort();
      }
    }
  }

  const cyclic = skills.map((skill) => skill.id).filter((id) => !order.includes(id));

  const territories = Object.fromEntries(
    TERRITORIES.map((territory) => [territory, [] as string[]]),
  ) as Record<Territory, string[]>;
  for (const skill of [...skills].sort((a, b) => a.id.localeCompare(b.id))) {
    territories[skill.territory].push(skill.id);
  }

  return {
    graph: {
      order,
      depth,
      dependents: Object.fromEntries(
        [...dependents.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, list]) => [id, [...list].sort()]),
      ),
      territories,
    },
    cyclic,
  };
}

/** Every transitive prerequisite of `id` (excluding itself), following only known skills. */
export function transitivePrerequisites(id: string, byId: ReadonlyMap<string, Skill>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(byId.get(id)?.prerequisites ?? [])];
  while (stack.length > 0) {
    const next = stack.pop() as string;
    if (seen.has(next)) continue;
    seen.add(next);
    stack.push(...(byId.get(next)?.prerequisites ?? []));
  }
  seen.delete(id);
  return seen;
}

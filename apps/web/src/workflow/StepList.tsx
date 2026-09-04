import {
  Button,
  InkSurface,
  WorkflowNode as NodeCard,
  type WorkflowNodeStatus,
} from '@bloomlab/design-system';
import type {
  AccountState,
  ExecutionRecord,
  Workflow,
  WorkflowRun,
} from '@bloomlab/simulator-core';

import { orderedSteps } from './graphEdit';
import { paletteEntry } from './palette';
import { configSummary, nodeKind, nodeName, nodeStatus } from './words';
import styles from './workflow.module.css';

/**
 * The vertical step editor (WFL-006, RSP-004).
 *
 * On a phone the canvas is not shrunk; the workflow is read as the ordered list it is, trigger
 * first, each branch's path indented under its If/Else, with the same light nodes and the same
 * statuses. Tapping a step opens its inspector in a sheet; "Add a step here" places one after it.
 * Nothing the desktop can do is missing — it is arranged for one thumb.
 */

export interface StepListProps {
  workflow: Workflow;
  account: AccountState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddAfter: (afterId: string | null, branch: string | null) => void;
  watched: WorkflowRun | null;
  records: ExecutionRecord[];
}

export function StepList({
  workflow,
  account,
  selectedId,
  onSelect,
  onAddAfter,
  watched,
  records,
}: StepListProps) {
  const steps = orderedSteps(workflow);
  const trigger = paletteEntry(workflow.trigger.ghl_feature_id);
  return (
    <InkSurface depth="deep" padding="none">
      <ol className={styles.steps} aria-label="Workflow steps, in order">
        <li className={styles.step}>
          <NodeCard
            kind="trigger"
            name={trigger ? trigger.name : 'Choose a trigger'}
            config={
              workflow.trigger.filters.length > 0
                ? `${workflow.trigger.filters.length} filter(s)`
                : 'No filters'
            }
            selected={selectedId === 'trigger'}
            approximation={Boolean(trigger?.approximation)}
            onClick={() => onSelect('trigger')}
            data-node="trigger"
          />
          {steps.length === 0 && (
            <div className={styles.stepActions}>
              <Button size="sm" variant="secondary" onClick={() => onAddAfter(null, null)}>
                Add the first step
              </Button>
            </div>
          )}
        </li>
        {steps.map(({ node, depth, branch }, index) => {
          const previous = steps[index - 1];
          const newBranch = branch && (!previous || previous.branch !== branch);
          const status: WorkflowNodeStatus = nodeStatus(node, watched, records);
          const runnable =
            node.type === 'end' || paletteEntry(node.ghl_feature_id)?.runnable === true;
          return (
            <li
              key={node.id}
              className={styles.step}
              style={{ paddingLeft: `${Math.min(depth, 3) * 16}px` }}
            >
              {newBranch && <p className={styles.stepBranch}>Branch: {branch}</p>}
              <NodeCard
                kind={nodeKind(node)}
                name={runnable ? nodeName(node) : `${nodeName(node)} (practised in GHL)`}
                config={configSummary(node, account)}
                status={runnable ? status : 'failed'}
                approximation={Boolean(paletteEntry(node.ghl_feature_id)?.approximation)}
                selected={selectedId === node.id}
                onClick={() => onSelect(node.id)}
                data-node={node.id}
              />
              {node.type !== 'end' && (
                <div className={styles.stepActions}>
                  {node.type === 'branch' ? (
                    <div className={styles.actions}>
                      {branchNamesOf(node).map((name) => (
                        <Button
                          key={name}
                          size="sm"
                          variant="ghost"
                          onClick={() => onAddAfter(node.id, name)}
                        >
                          Add to “{name}”
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => onAddAfter(node.id, null)}>
                      Add a step here
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </InkSurface>
  );
}

const branchNamesOf = (node: Workflow['nodes'][number]): string[] => {
  const branches = Array.isArray(node.config.branches)
    ? (node.config.branches as { name?: unknown }[])
    : [];
  return [
    ...branches.map((row) => (typeof row.name === 'string' ? row.name : '')).filter(Boolean),
    'None',
  ];
};

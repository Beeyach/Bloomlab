export interface SequenceStep {
  key: string;
  label: string;
  brief: string;
  depends_on: string[];
}
export function sequenceState(steps: readonly SequenceStep[], order?: readonly string[]) {
  const ids = order ?? steps.map((step) => step.key);
  const complete =
    steps.length > 0 &&
    ids.length === steps.length &&
    new Set(ids).size === steps.length &&
    steps.every((step) => ids.includes(step.key));
  return {
    complete,
    valid:
      complete &&
      steps.every((step) =>
        step.depends_on.every((dependency) => ids.indexOf(dependency) < ids.indexOf(step.key)),
      ),
  };
}

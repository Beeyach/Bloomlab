# Phase 24 — Field Ready implementation record

This is the third stacked delta, targeting `codex/phase-23-portfolio`. PRs #24 and #25 remain parked. No merge is authorized. Phase 22 human acceptance and the seven Phase 21 human-unverified rows remain unchanged.

## Checkpoint 1 — foundations

The pre-authoring machine-readable audit is `phase-24-baseline.json`, captured from content hash `ff28e95f24c6` at branch head `6735ee1`. The campaign has 20 skills, six placement mappings, empty Gates 6 and 12, and two projects. The full graph has five learning units, 35 exercises and five client industries. Custom values has no practical exercise.

The compiler now emits `coverage-field-ready.json`. Coverage cites authored learning units and exercises for each acceptance topic, counts each relevant item's estimated duration once, and derives scenario relevance from the referenced client's industry. The ratio tolerance is explicitly **±10 percentage points** around 20/60/20. Retrieval time includes authored retrieval, explanation, selling and review work; classification is content data, not fabricated analytics. Topic citations remain subject to substantive editorial review; merely adding a tag is not evidence that the teaching is adequate.

`coverage_enforced` is false during the ordered authoring checkpoints, so gaps are visible warnings. The final campaign must enable it before completion. Invalid topic tokens always fail schema validation; non-current Funnel Builder references always fail compilation.

MAS-010 checks ten domains independently against valid, owned, unassisted canonical evidence. Placement and retrieval cannot substitute for later independent application. Fieldwork needs a passed manual real-GHL evidence record with proof references. This evaluator is only the domain check; campaign and capstone completion must also pass. Automated fixtures do not establish Ary's human acceptance.

No schema migration or provider call is introduced by this checkpoint. No requirement is promoted from foundations alone.

/* global window, IDBObjectStore */
// Explicitly controlled canonical records: technical UI verification, never human acceptance.
export async function seedFieldReady(bundle, complete) {
  const p = window.__fieldworkProbe;
  const d = (await p.rows('device'))[0];
  let tick = 0;
  const start = Date.now() - 1000 * 60 * 1000;
  const stamp = () => new Date(start + ++tick * 60000).toISOString();
  const envelope = (id, at) => ({
    id,
    learner_id: d.learner_id,
    device_id: d.device_id,
    created_at: at,
    updated_at: at,
    revision: 1,
    deleted_at: null,
  });
  const versions = {
    app: '0.1.0',
    content: bundle.content_version,
    content_hash: bundle.content_hash,
    simulator: '1',
    rules: '2026.09.09-r5',
  };
  const add = async (exerciseId) => {
    const e = bundle.exercises.find((row) => row.id === exerciseId),
      id = crypto.randomUUID(),
      at = stamp();
    const fieldwork = e.type === 'FIELDWORK';
    const common = {
      source: { type: fieldwork ? 'fieldwork' : 'exercise', id: e.id },
      exercise_id: e.id,
      exercise_type: e.type,
      result: 'passed',
      score: 100,
      assistance: 'independent',
      hints_used: [],
      difficulty: e.difficulty,
      critical_failures: [],
      mode: e.mode,
      versions,
    };
    const choice =
      e.decision_options.find((option) => option.value === 'two_locations')?.value ??
      e.decision_options[0]?.value ??
      null;
    await p.put('exercise_attempts', {
      ...envelope(id, at),
      ...common,
      skill_ids: e.skills,
      started_at: at,
      completed_at: at,
      response: {
        choice,
        text: 'Controlled browser fixture. No real client or human GHL acceptance.',
        prediction: {},
        written: {},
      },
      grade: null,
    });
    const kinds = {
      PROSPECT_IT: 'sales_use',
      AUDIT_IT: 'sales_use',
      WRITE_IT: 'sales_use',
      SAY_IT: 'sales_use',
      PRICE_IT: 'sales_use',
      NEGOTIATE_IT: 'sales_use',
      EXPLAIN_IT: 'explanation',
    };
    const kind = fieldwork
      ? 'fieldwork'
      : e.mode === 'guided'
        ? 'guided_practice'
        : (kinds[e.type] ?? (e.mode === 'pressure' ? 'pressure_test' : 'independent_exercise'));
    for (const skill_id of e.skills)
      await p.put('skill_evidence', {
        ...envelope(crypto.randomUUID(), at),
        ...common,
        skill_id,
        kind,
        attempt_id: id,
        occurred_at: at,
        real_ghl: fieldwork
          ? { required: true, provided: true, evidence: ['fixture:manual-proof'] }
          : null,
      });
    return id;
  };
  if (complete) {
    const campaign = bundle.campaigns.find((row) => row.id === 'CAMP-FIELD_READY');
    for (const gate of campaign.gates.filter((row) => !row.placement))
      for (const skill of gate.skills) {
        const vehicles = bundle.exercises.filter(
          (e) =>
            e.skills.includes(skill) &&
            !e.placement_area &&
            ['independent', 'pressure'].includes(e.mode),
        );
        for (let n = 0; n < gate.pass_criteria.independent_evidence_per_skill; n++)
          await add(vehicles[n % vehicles.length].id);
        if (gate.pass_criteria.pressure_test_required)
          await add(vehicles.find((e) => e.mode === 'pressure').id);
        if (gate.pass_criteria.fieldwork_required)
          await add(vehicles.find((e) => e.type === 'FIELDWORK').id);
      }
  }
  for (const project of bundle.projects.filter((row) => complete || row.boss_client)) {
    const stage_attempts = {};
    for (const [i, stage] of project.stages.entries()) {
      if (!complete && i > 7) break;
      stage_attempts[stage.id] = {};
      for (const id of stage.exercises) stage_attempts[stage.id][id] = await add(id);
      for (const rule of stage.conditional_exercises)
        for (const id of rule.exercises) {
          const attempt = await add(id);
          if (complete) stage_attempts[stage.id][id] = attempt;
        }
    }
    const record = (await p.rows('client_progress')).find(
      (row) => row.client_id === project.client,
    );
    await p.put('client_progress', {
      ...record,
      engagements: {
        ...record.engagements,
        [project.id]: { content_version: bundle.content_version, stage_attempts },
      },
    });
  }
  return { attemptsAdded: tick, complete, kind: 'Controlled technical evidence only' };
}

// Exercise actual loading/read/save error paths without damaging the disposable database.
export function installClientStorageFaults() {
  const getAll = IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll = function (...args) {
    if (this.name === 'client_progress' && sessionStorage.getItem('client-read-fault'))
      throw new Error('Controlled read failure');
    const request = getAll.apply(this, args);
    if (this.name === 'client_progress' && sessionStorage.getItem('client-read-delay')) {
      Object.defineProperty(request, 'onsuccess', {
        set(handler) {
          request.addEventListener('success', (event) => setTimeout(() => handler(event), 2500));
        },
      });
    }
    return request;
  };
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === 'client_progress' && sessionStorage.getItem('client-write-fault'))
      throw new Error('Controlled save failure');
    return put.apply(this, args);
  };
}

// Disposable IndexedDB fixtures exercise presentation and saved-state compatibility. They
// never establish real learner mastery, real GHL proof or a live provider outcome.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openPage, resetIndexedDbFixture, setViewport } from './cdp.mjs';
import { fieldworkFixtures } from './fieldwork-fixtures.mjs';
import { seedFieldReady } from './field-ready-fixtures.mjs';
import { INCIDENT_NA_REASON } from './exact-state-evidence.mjs';

const bundle = JSON.parse(readFileSync('.content/bundle.json', 'utf8'));
const has = (text) =>
  `document.querySelector('main')?.textContent.includes(${JSON.stringify(text)})`;
const database = 'window.__fieldworkProbe';

const EMPTY = {
  home: ['Nothing due.', 'Empty retrieval queue with no submitted evidence'],
  campaign: ['0 of', 'Zero passed gates with no submitted evidence'],
  skills: ['0 of', 'No demonstrated capabilities; authored capabilities remain visible'],
  'skill-detail': ['No evidence yet.', 'Empty evidence history for the named capability'],
  'field-ready': ['Missing work stays visible below.', 'Missing training evidence stays visible'],
  workflow: ['No run yet.', 'Empty execution timeline; the starter workflow is not an empty graph'],
  calendar: ['Nothing yet.', 'Empty calendar event history'],
  reporting: ['Nothing to report on.', 'Empty operating report does not invent rates'],
  conversations: ['No messages yet.', 'Empty simulated inbox'],
  'client-detail': ['No relationship notes yet.', 'Empty fictional relationship journal'],
  'project-detail': ['No eligible result yet.', 'Project has no eligible submitted results'],
  portfolio: ['Your archive starts with the work.', 'Empty saved-work archive'],
  'portfolio-item': [
    'This project has no assembled work on this device.',
    'Missing assembled work for the exact template',
  ],
  playground: ['Nothing yet. Open a scenario above', 'No unlocked features or saved scenario'],
  'ai-settings': [
    'Link this device to see account usage',
    'Unlinked device has no server usage data',
  ],
  sync: ['Create a sync key', 'Unlinked device offers recovery-key creation'],
  'incident-case': ['Nothing has run yet.', 'Empty incident reproduction log'],
};

async function removeDraft(page, id) {
  await page.evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('bloomlab');
    r.onerror=()=>reject(Error('Fixture database unavailable'));r.onsuccess=()=>{
    const db=r.result,tx=db.transaction('workspace','readwrite');
    tx.objectStore('workspace').delete(${JSON.stringify(`exercise.attempt.${id}`)});
    tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(Error('Fixture removal failed'))}}})`);
}

async function legacyResult(page, exercise) {
  await page.evaluate(`(async()=>{
    const e=${JSON.stringify(exercise)},p=${database},d=(await p.rows('device'))[0],
      at=new Date().toISOString(),id='exact-legacy-'+e.id;
    const response={text:'Controlled saved-state presentation fixture, not accepted learner work.',
      choice:null,prediction:{},written:{}};
    if(e.call)response.call={version:1,phase:'complete',notes:'',retain_audio:false,elapsed_ms:0,
      recording_id:null,transcript_draft:'',snapshot:{attempt_id:id,exercise_id:e.id,
      content_version:${JSON.stringify(bundle.content_version)},turn:0,current:{node:'fixture-end',
      text:'Controlled practice complete.',dynamic:false},turns:[],complete:true,
      projection:{complete:true,turns:0,talk_ratio_learner:null,pitched_before_diagnosis:false,
        diagnosis_agreed:false,next_step_agreed:false,economically_sound:false,structurally_sound:false}}};
    if(e.type==='FIELDWORK')response.fieldwork={version:1,contract:JSON.stringify(e.fieldwork),
      phase:'reasoning',configuration:{},explanations:{},tests:{},screenshots:{},reasoning:{},
      confirmed:false,checkpoint:null};
    await p.put('exercise_attempts',{id,learner_id:d.learner_id,device_id:d.device_id,
      created_at:at,updated_at:at,revision:1,deleted_at:null,exercise_id:e.id,exercise_type:e.type,
      skill_ids:e.skills,source:{type:e.type==='FIELDWORK'?'fieldwork':'exercise',id:e.id},
      started_at:at,completed_at:at,result:'failed',score:0,assistance:'independent',hints_used:[],
      difficulty:e.difficulty,critical_failures:[],mode:e.mode,
      versions:{app:'0.1.0',content:${JSON.stringify(bundle.content_version)},
        content_hash:${JSON.stringify(bundle.content_hash)},simulator:'1',rules:'2026.09.09-r5'},
      grade:null,response});return true;
  })()`);
  await removeDraft(page, exercise.id);
}

export async function runSemanticStates({
  page,
  base,
  screens,
  wait,
  click,
  typeInto,
  createKeyAndLink,
  record,
  identity,
}) {
  await setViewport(page, 1440, 900);
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${fieldworkFixtures.toString()})(false,'')`,
  });
  const go = async (screen, fresh = false) => {
    if (fresh) await resetIndexedDbFixture(page, base);
    await openPage(page, base + screen.path);
    await wait(
      "!!document.querySelector('main h1')&&!!window.__fieldworkProbe",
      `${screen.name} semantic fixture ready`,
    );
    await identity(screen);
  };
  const enter = async (selector, text) => {
    await wait(`!!document.querySelector(${JSON.stringify(selector)})`, 'Native text field ready');
    await typeInto(page, selector, text);
  };
  const activate = async (wanted) => {
    const expression =
      wanted.startsWith('#') || wanted.includes('[')
        ? `document.querySelector(${JSON.stringify(wanted)})`
        : `[...document.querySelectorAll('main button,main a')].find(e=>e.textContent.trim()===${JSON.stringify(wanted)})`;
    await wait(
      `(() => {const e=${expression};return !!e&&!e.disabled&&e.getClientRects().length>0})()`,
      'Native action ready',
    );
    await click(page, wanted);
  };
  for (const screen of screens) {
    if (screen.exercise_type) {
      await go(screen, true);
      const key = `exercise.attempt.${screen.content_id}`;
      await wait(
        `(async()=>{const p=${database},w=(await p.rows('workspace')).find(r=>r.key===${JSON.stringify(key)});
        return !!w&&!w.value.response.text&&w.value.response.choice===null&&
          !Object.keys(w.value.response.prediction).length&&!w.value.hints_revealed.length&&
          !(await p.rows('exercise_attempts')).length})()`,
        `${screen.name} empty learner draft`,
      );
      assert(
        !(await page.evaluate("!!document.querySelector('#result-title')")),
        'Opening cannot create a result',
      );
      await record(
        screen,
        'empty',
        'New persisted draft with no submitted history, text, choice, prediction or hints; authored defaults may be present.',
        [
          'exact screen path and browser build',
          'new empty learner draft persisted',
          'no submitted result or evidence from opening',
        ],
      );
      const exercise = bundle.exercises.find((row) => row.id === screen.content_id);
      await legacyResult(page, exercise);
      await go(screen);
      await wait(
        "document.querySelector('#result-title')?.textContent==='Recorded'",
        `${screen.name} legacy saved result`,
      );
      assert.equal(
        await page.evaluate(`(async()=> (await ${database}.rows('skill_evidence')).length)()`),
        0,
      );
      await record(
        screen,
        'completed',
        'Explicitly controlled FAILED legacy attempt with grade:null renders saved history. This does not verify fresh grading, provider work, or GHL proof.',
        [
          'exact screen path and browser build',
          'saved result survives document reload',
          'legacy result rendered as Recorded',
          'no passing evidence or mastery created by the fixture',
        ],
      );
    } else if (EMPTY[screen.name]) {
      await go(screen, true);
      await wait(has(EMPTY[screen.name][0]), `${screen.name} empty-state copy`);
      assert.equal(
        await page.evaluate(`(async()=> (await ${database}.rows('skill_evidence')).length)()`),
        0,
      );
      await record(screen, 'empty', EMPTY[screen.name][1], [
        'exact screen path and browser build',
        'named empty-state UI is visible',
        'no skill evidence exists in the disposable fixture',
      ]);
    }
  }
  for (const name of ['search', 'clients', 'crm', 'payments', 'funnel']) {
    const screen = screens.find((row) => row.name === name);
    await go(screen, true);
    if (['search', 'clients', 'crm'].includes(name)) {
      await wait("!!document.querySelector('main input')", 'Search field ready');
      await enter('main input', 'exact-fixture-no-matches-9f284');
      await wait(
        has(
          name === 'clients'
            ? 'No clients match this search.'
            : name === 'crm'
              ? 'No contact matches that.'
              : 'No matches.',
        ),
        `${name} no-match UI`,
      );
    } else if (name === 'payments') {
      await activate('Links & invoices');
      await wait(has('No payment links or invoices yet.'), 'Empty offers UI');
    } else {
      await activate('[data-testid="funnel-new"]');
      await activate('[data-testid="funnel-mode-preview"]');
      await wait(has('Add a step to preview it.'), 'Empty funnel preview UI');
    }
    await record(
      screen,
      'empty',
      name === 'funnel'
        ? 'New blank draft has no steps to preview.'
        : name === 'payments'
          ? 'No local training offers exist.'
          : 'Native query with no matching records.',
      [
        'exact screen path and browser build',
        'controlled empty state rendered its specific recovery copy',
      ],
    );
  }
  for (const screen of screens.filter((row) => row.family === 'academy')) {
    await go(screen, true);
    await activate('Finish this unit');
    await wait(has('You finished this unit'), 'Unit completion UI');
    await go(screen);
    await wait(has('You finished this unit'), 'Unit completion survives reload');
    await record(
      screen,
      'completed',
      'Native Finish this unit persists reading exposure and reopens the completed unit; this does not establish mastery.',
      [
        'exact screen path and browser build',
        'native completion changed the real screen',
        'completion persisted after document reload',
      ],
    );
  }
  for (const name of [
    'search',
    'clients',
    'client-detail',
    'reporting',
    'playground',
    'ai-settings',
    'calendar',
    'workflow',
    'payments',
    'conversations',
    'funnel',
    'incident-case',
    'crm',
  ]) {
    const screen = screens.find((row) => row.name === name);
    await go(screen, true);
    let outcome;
    if (name === 'search' || name === 'clients') {
      await enter('main input', name === 'search' ? 'workflow' : 'Glowhaus');
      outcome =
        name === 'search'
          ? '!!document.querySelector(\'main a[href^="/search#"]\')'
          : '!!document.querySelector(\'main a[href="/clients/CL-glowhaus-medspa"]\')';
    } else if (name === 'client-detail') {
      await enter('main textarea', 'Controlled fictional relationship note.');
      await activate('Save note');
      outcome = has('Relationship note saved on this device.');
    } else if (name === 'reporting') {
      await activate('[data-testid="run-window"]');
      outcome = "!!document.querySelector('[data-testid=largest-loss]')";
    } else if (name === 'playground') {
      await activate('[data-testid="open-run"]');
      outcome = has('1 saved run');
    } else if (name === 'ai-settings') {
      await wait("!!document.querySelector('main select')", 'AI mode selector ready');
      await page.evaluate("document.querySelector('main select').focus()");
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'ArrowUp',
        code: 'ArrowUp',
        windowsVirtualKeyCode: 38,
      });
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'ArrowUp',
        code: 'ArrowUp',
        windowsVirtualKeyCode: 38,
      });
      outcome = `(async()=> (await ${database}.rows('workspace')).some(r=>r.key==='ai.mode'&&r.value==='Off'))()`;
    } else if (name === 'calendar') {
      await activate('[data-testid="calendar-add"]');
      await activate('[data-testid="calendar-save"]');
      outcome = "document.querySelector('[data-testid=calendar-save]')?.disabled===true";
    } else if (name === 'workflow') {
      await activate('[data-testid="start-first-step"]');
      outcome = "!!document.querySelector('[data-testid=timing]')";
    } else if (name === 'payments') {
      await enter('main form input[name="id"]', 'exact-state-product');
      await enter('main form input[name="name"]', 'Controlled training product');
      await activate('Save product');
      outcome = has('Controlled training product');
    } else if (name === 'conversations') {
      await wait("!!document.querySelector('#inbox-contact')", 'Inbox contact selector ready');
      await page.evaluate("document.querySelector('#inbox-contact').focus()");
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'ArrowDown',
        code: 'ArrowDown',
        windowsVirtualKeyCode: 40,
      });
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'ArrowDown',
        code: 'ArrowDown',
        windowsVirtualKeyCode: 40,
      });
      await wait(
        "!!document.querySelector('#inbox-body')",
        'Native contact selection opened composer',
      );
      await enter('#inbox-body', 'Controlled inbound simulation message.');
      await activate('main form button[type="submit"]');
      outcome = has('Controlled inbound simulation message.');
    } else if (name === 'funnel') {
      await activate('[data-testid="funnel-new"]');
      await activate('[data-testid="funnel-mode-build"]');
      await enter('[data-testid="funnel-step-name"]', 'Controlled draft step');
      await activate('[data-testid="funnel-step-add"]');
      await activate('[data-testid="funnel-save"]');
      outcome = "document.querySelector('[data-testid=funnel-save]')?.disabled===true";
    } else if (name === 'crm') {
      await activate('New contact');
      await enter('main form input', 'ControlledContact');
      await activate('Create contact');
      outcome = has('ControlledContact');
    } else {
      await activate('[data-testid="reproduce"]');
      outcome =
        "!document.querySelector('[data-testid=log-empty]')&&!!document.querySelector('[data-testid^=log-reason-]')";
    }
    await wait(outcome, `${name} named result state`);
    await record(
      screen,
      'completed',
      `Native ${name} result: ${name === 'workflow' ? 'operator-started simulation' : name === 'ai-settings' ? 'persisted local AI Off' : name === 'conversations' ? 'inbound simulated message; no email or SMS' : 'local training state'}. This is the named action result, not certification of the whole domain.`,
      [
        'exact screen path and browser build',
        'native action produced its named real UI or persisted result',
      ],
    );
  }
  // Reuse the already-audited explicit presentation fixture for completed graph/project states.
  const clients = screens.find((row) => row.name === 'clients');
  await go(clients, true);
  await wait(has('Glowhaus Med Spa'), 'Client records ready for controlled completion fixture');
  await page.evaluate(`(${seedFieldReady.toString()})(${JSON.stringify(bundle)},true)`);
  const completed = {
    home: "!!document.querySelector('section[aria-labelledby=recent-title] li')",
    campaign: has('Every gate passed.'),
    skills:
      "[...document.querySelectorAll('[data-territory]')].some(e=>/[1-9]\\d* of/.test(e.textContent))",
    'skill-detail': `!!document.querySelector('[data-testid=skill-detail] section[aria-labelledby$="-evidence"] li')`,
    'field-ready': has('Field Ready certificate'),
    'project-detail': has('Project evidence complete.'),
    portfolio: '!!document.querySelector(\'main a[href^="/portfolio/PF-"]\')',
    'portfolio-item': has('Consultation Booking System'),
  };
  for (const [name, outcome] of Object.entries(completed)) {
    const screen = screens.find((row) => row.name === name);
    await go(screen);
    await wait(outcome, `${name} explicit completed presentation fixture`);
    await record(
      screen,
      'completed',
      'Explicit existing canonical presentation fixture for saved training evidence. Includes synthetic proof references; never human, real-GHL, or real learner acceptance.',
      [
        'exact screen path and browser build',
        'named completed presentation rendered from the disposable canonical fixture',
      ],
    );
  }
  const incident = screens.find((row) => row.name === 'incident');
  await go(incident, true);
  const expectedCases = bundle.scenarios.filter((row) => row.incident).length;
  assert(expectedCases > 0, 'The authored incident directory must contain actual cases');
  await wait(
    `document.querySelectorAll('main a[href^="/incident/SC-"]').length===${expectedCases}`,
    'Every authored incident case is listed',
  );
  for (const state of ['empty', 'completed'])
    await record(
      incident,
      state,
      INCIDENT_NA_REASON,
      [
        'exact screen path and browser build',
        'all current authored cases are present; directory has no submission lifecycle',
      ],
      undefined,
      {
        reason: INCIDENT_NA_REASON,
        sources: ['apps/web/src/incident/IncidentRoom.tsx', '.content/bundle.json'],
      },
    );
  const sync = screens.find((row) => row.name === 'sync');
  await resetIndexedDbFixture(page, base);
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
    const original=window.fetch.bind(window);let device;
    window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);
      if(url.origin===location.origin&&url.pathname==='/api/sync/link'){
        device=JSON.parse(init.body).device;
        return Response.json({learner_id:'controlled-exact-state-learner',device_id:device.device_id,
          session_token:'controlled-exact-state-session',created:true});
      }
      if(url.origin===location.origin&&url.pathname==='/api/sync/devices')return Response.json({devices:[{
        device_id:device.device_id,device_label:'Controlled disposable browser',current:true,
        created_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),revoked_at:null}]});
      return original(input,init);
    };
  })()`,
  });
  const linked = await createKeyAndLink({ page, go: (path) => openPage(page, base + path) });
  assert(linked.linked, 'Native synthetic link flow completed');
  await identity(sync);
  assert(
    await page.evaluate(
      `(async()=> (await ${database}.rows('device')).some(d=>d.learner_id==='controlled-exact-state-learner'&&!!d.session_token))()`,
    ),
    'Synthetic link session persisted',
  );
  await record(
    sync,
    'completed',
    'Native key creation and device linking persist under an explicit local acknowledgement fixture. No real Worker integration or recovery backup acceptance is claimed.',
    [
      'exact screen path and browser build',
      'native link dialog completed',
      'synthetic session persisted; private key omitted from evidence',
    ],
  );
}

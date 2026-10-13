// Real learner fallback and an injected dependency checked by the same C1 path verdict.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openPage, session } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

assert.equal(process.env.REVIEW_AI_OFF, '1');
const base = process.env.BASE;
const out = resolve(process.env.REVIEW_OUT);
const negative = process.env.REVIEW_AI_OFF_NEGATIVE === '1';
const { page, close } = await session();
const { waitFor, typeInto, click } = probeHelpers({ base });
const report = { head: process.env.REVIEW_HEAD, base, negative };
mkdirSync(out, { recursive: true });
try {
  await openPage(page, base + '/settings/ai');
  assert(await waitFor(page, `!!document.querySelector('main select')`));
  await page.evaluate(`(() => {
    const el = document.querySelector('main select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, 'Off');
    el.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert(await waitFor(page, `document.querySelector('main select')?.value === 'Off'`));
  if (!negative) {
    const path = '/exercise/EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads';
    const answer =
      'Start with an owned manual callback queue and daily review. Verify response times and consent before introducing automation.';
    await openPage(page, base + path);
    assert(await waitFor(page, `!!document.querySelector('main textarea')`));
    await typeInto(page, 'main textarea', answer);
    await click(page, 'Run it');
    assert(
      await waitFor(
        page,
        `/AI Coaching is Off/i.test(document.querySelector('main')?.textContent)`,
      ),
    );
    await openPage(page, base + path);
    assert(
      await waitFor(
        page,
        `document.querySelector('main textarea')?.value === ${JSON.stringify(answer)}`,
      ),
    );
    report.savedPendingReload = true;
  }
  await openPage(page, base + '/crm');
  assert(
    await waitFor(
      page,
      `document.querySelector('main h1')?.textContent.trim() === 'CRM' && !document.body.textContent.includes('Opening the training account')`,
    ),
  );
  report.crmUsable = true;
  if (negative) {
    // The child itself succeeds only if the unavailable route rejects. C1 must still classify
    // this otherwise successful deterministic path as FAILED because it attempted AI.
    report.injectedRequestBlocked = await page.evaluate(
      `fetch('/api/ai/field-ready-negative-control', { method: 'POST' }).then(() => false, error => error instanceof TypeError)`,
    );
    assert.equal(report.injectedRequestBlocked, true);
  }
  report.passed = true;
} finally {
  writeFileSync(resolve(out, 'control.json'), JSON.stringify(report, null, 2) + '\n');
  await close();
}

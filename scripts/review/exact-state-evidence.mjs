import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONTROLLED_STATE_ATTEMPTS = 80;

/** Ordinary lazy loading is not evidence until this route's controlled request is intercepted. */
export async function waitForControlledState({ intercepted, visible, pause }) {
  for (let attempt = 0; attempt < CONTROLLED_STATE_ATTEMPTS; attempt++) {
    if (intercepted() && (await visible())) return true;
    await pause();
  }
  return false;
}

function interceptionFailure(event, error, origin, canceled) {
  const url = new URL(event.request.url);
  const invalidId = /^Invalid InterceptionId\.?\s*$/.test(error?.message ?? '');
  const extension = { Script: 'js', Stylesheet: 'css' }[event.resourceType];
  const asset = extension && new RegExp(`^/assets/[^/]+\\.${extension}$`).test(url.pathname);
  if (
    invalidId &&
    url.origin === origin &&
    asset &&
    typeof event.networkId === 'string' &&
    event.networkId &&
    canceled.has(event.networkId)
  ) {
    return {
      category: 'CONFIRMED_LOCAL_ASSET_CANCELLATION',
      resource: event.resourceType,
      path: url.pathname,
    };
  }
  return {
    category: invalidId ? 'INVALID_INTERCEPTION_ID' : 'UNEXPECTED_INTERCEPTION_FAILURE',
    resource: event.resourceType,
    api: url.pathname.startsWith('/api/'),
  };
}

/** Correlate only browser-observed local asset cancellation; transport failures stay fatal. */
export function createInterceptionTracker(base) {
  const origin = new URL(base).origin;
  const canceled = new Set();
  const pending = new Set();
  const rejected = [];
  return {
    loadingFailed(event) {
      if (event.canceled === true && typeof event.requestId === 'string' && event.requestId)
        canceled.add(event.requestId);
    },
    track(event, handle) {
      const job = Promise.resolve()
        .then(handle)
        .catch((error) => rejected.push({ event, error }))
        .finally(() => pending.delete(job));
      pending.add(job);
      return job;
    },
    async drain() {
      while (pending.size) await Promise.all([...pending]);
    },
    results() {
      const failures = [];
      const localAssetCancellations = [];
      for (const { event, error } of rejected) {
        const result = interceptionFailure(event, error, origin, canceled);
        if (result.category === 'CONFIRMED_LOCAL_ASSET_CANCELLATION')
          localAssetCancellations.push(result);
        else failures.push(result);
      }
      return { failures, localAssetCancellations };
    },
  };
}

export function injectNotFoundFault(source) {
  const marker = /(["'`])Nothing at this address\.\1/g;
  assert.equal([...source.matchAll(marker)].length, 1, 'NotFound render marker must be unique');
  return source.replace(
    marker,
    '(()=>{throw new Error("Controlled NotFound render exception")})()',
  );
}

export function verifyExactArtifacts(cells, directory) {
  for (const cell of cells) {
    for (const [name, digest] of [
      [cell.screenshot, cell.screenshot_sha256],
      ...(cell.input?.before_screenshot
        ? [[cell.input.before_screenshot, cell.input.before_sha256]]
        : []),
    ]) {
      const artifact = resolve(directory, name);
      assert(existsSync(artifact), 'Missing exact-state screenshot');
      assert.equal(
        createHash('sha256').update(readFileSync(artifact)).digest('hex'),
        digest,
        'Exact-state screenshot bytes do not match',
      );
    }
  }
}

const STATES = ['empty', 'loading', 'error', 'completed', 'keyboard', 'touch'];
export const INCIDENT_NA_REASON =
  'The current Git-owned incident directory is an authored case index, not a runtime collection or an attempt. Empty execution logs and recorded results belong to the separate incident-case screen.';

/** Missing evidence stays missing; malformed evidence fails closed instead of borrowing a family PASS. */
export function joinExactStates(report, head, screens) {
  const joined = new Map();
  if (report === undefined) return joined;
  assert(head && report.head === head, 'Exact-state report must match the requested head');
  assert.equal(report.status, 'PASSED', 'Exact-state report did not pass');
  assert(Array.isArray(report.cells), 'Exact-state cells are missing');
  for (const cell of report.cells) {
    const screen = screens.find((candidate) => candidate.name === cell.name);
    assert(screen && cell.path === screen.path, 'Exact-state screen identity does not match');
    assert(STATES.includes(cell.state), 'Unknown exact state');
    assert.equal(cell.head, head, 'Exact-state source does not match');
    assert.equal(cell.browser_head, head, 'Exact-state browser build does not match');
    const applicable = cell.status !== 'N/A';
    if (!applicable) {
      assert(
        cell.name === 'incident' && ['empty', 'completed'].includes(cell.state),
        'Unsupported lifecycle exception',
      );
      assert.equal(
        cell.reason,
        INCIDENT_NA_REASON,
        'Lifecycle exception requires its reviewed policy',
      );
    } else assert.equal(cell.status, 'PASSED', 'Exact-state cell did not pass');
    assert.equal(
      cell.screenshot,
      `${screen.name}-${cell.state}.png`,
      'Exact-state artifact does not match',
    );
    assert(
      /^[a-f0-9]{64}$/.test(cell.screenshot_sha256 ?? ''),
      'Exact-state screenshot digest is required',
    );
    assert(typeof cell.scope === 'string' && cell.scope.trim(), 'Assertion scope is required');
    assert(
      cell.assertions?.length &&
        cell.assertions.every(
          (row) => typeof row.name === 'string' && row.name.trim() && row.passed === true,
        ),
      'Exact-state assertions are missing or failed',
    );
    if (['keyboard', 'touch'].includes(cell.state)) {
      assert.equal(cell.input?.kind, cell.state, 'Exact-state input kind does not match');
      assert.equal(cell.input.trusted, true, 'Native trusted input is required');
      assert.equal(
        cell.input.before_screenshot,
        `${screen.name}-${cell.state}-before.png`,
        'Native input artifact must show the original screen before activation',
      );
      assert(
        /^[a-f0-9]{64}$/.test(cell.input.before_sha256 ?? ''),
        'Native input artifact digest is required',
      );
      assert(cell.input.events.includes('click'), 'Native activation is required');
      assert(
        cell.input.events.includes(cell.state === 'keyboard' ? 'keydown' : 'touchend'),
        'Native input sequence is required',
      );
    }
    const id = `${cell.name}:${cell.state}`;
    assert(!joined.has(id), 'Duplicate exact-state attribution');
    joined.set(id, { ...cell, status: applicable ? 'PROVEN_BROWSER' : 'N/A' });
  }
  return joined;
}

import type { AccountState, ExternalEndpoint, ExternalFailureKind } from '../state.ts';

/**
 * What happens when a Webhook action calls an outside service (SIM-011, D-139, D-140).
 *
 * Bloomlab makes no request. There is no network in the simulator, no HTTP client, no retry
 * engine and no secrets manager, and none of those are coming: this is enough deterministic
 * behaviour for a learner to tell two failures apart, and nothing more.
 *
 * The two failures are the point. "My credentials are wrong" is the caller's problem and the fix
 * is in the workflow; "the service is down" is not, and the fix is to wait or to handle it. A
 * troubleshooting phase that collapsed both into one red line would teach neither.
 *
 * A URL the scenario never described answers 200, which is what every scenario before Phase 15
 * assumed and what the registry has always called the approximation. Matching is on the whole URL:
 * a substring rule would quietly make one endpoint answer for another.
 */

export interface WebhookAnswer {
  status: number;
  /** Null when the call succeeded. */
  failure: ExternalFailureKind | null;
  /** The endpoint that answered, when the scenario described one. */
  endpoint_id: string | null;
  /** What the endpoint required, for the failure record. Never the token itself. */
  expected_header: string | null;
}

const OK: WebhookAnswer = { status: 200, failure: null, endpoint_id: null, expected_header: null };

/** The endpoint at exactly this URL, or none. */
export function endpointFor(account: AccountState, url: string): ExternalEndpoint | null {
  const trimmed = url.trim();
  return (
    Object.values(account.external_endpoints)
      .sort((a, b) => a.id.localeCompare(b.id))
      .find((endpoint) => endpoint.url === trimmed) ?? null
  );
}

/**
 * Header values a Webhook node sends. HighLevel's Custom Webhook action carries custom headers,
 * including `Authorization`, so this reads a real configuration field rather than a simulator
 * one; header names are compared case-insensitively, as HTTP header names are.
 */
export function readHeaders(config: Record<string, unknown>): Record<string, string> {
  const raw = config.headers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      headers[key.trim().toLowerCase()] = String(value);
    }
  }
  return headers;
}

/**
 * What the named service answers this call with.
 *
 * Credentials are checked before the outage, because that is the order that keeps the two
 * distinguishable: a service that is both down and refusing your token still tells you the token
 * is wrong, and fixing the token is the thing the learner controls.
 */
export function answerFor(
  account: AccountState,
  url: string,
  headers: Record<string, string>,
): WebhookAnswer {
  const endpoint = endpointFor(account, url);
  if (!endpoint) return OK;
  if (endpoint.auth) {
    const expected = endpoint.auth.header.trim().toLowerCase();
    const supplied = headers[expected];
    if (supplied === undefined || supplied.trim() !== endpoint.auth.token) {
      return {
        status: endpoint.unauthorized_status,
        failure: 'auth',
        endpoint_id: endpoint.id,
        expected_header: endpoint.auth.header,
      };
    }
  }
  if (endpoint.outage) {
    return {
      status: endpoint.outage.status,
      failure: endpoint.outage.kind,
      endpoint_id: endpoint.id,
      expected_header: null,
    };
  }
  return {
    status: endpoint.ok_status,
    failure: null,
    endpoint_id: endpoint.id,
    expected_header: null,
  };
}

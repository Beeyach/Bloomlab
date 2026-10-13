# Field-Ready follow-up: recovery, terminology and dependencies

This follow-up starts from `e4b7b606912a3ec21da688d36c8c881a8a680291`.
That source passed [CI 38334967218](https://github.com/Beeyach/Bloomlab/actions/runs/38334967218),
with Production skipped. The source changes described here need separate
exact-head CI and Preview evidence after an approved publication.

## Confirmed recovery defects

Cancellation previously deleted the staged R2 object before claiming cancelled
status in D1. A concurrent confirmation could win restoration while cancellation
still returned success. Cancellation now claims and checks the conditional D1
transition first, then deletes only the owned stage object. A failed deletion can
be retried from cancelled status without re-enabling confirmation.

Confirmation previously deleted its retry archive before durably recording
restored status. A failure on the final D1 update left failed status with no
archive for retry. Confirmation now checks the restored transition before
deleting the staged object. A deletion failure after restoration permits a
cleanup-only confirmation while that staged object exists; it does not repeat
asset restoration. Normal already-completed confirmation still returns 409,
preserving the existing browser-probe contract.

A delayed staging upload is also removed when its final conditional D1 update
loses to cancellation. This follows the existing attachment rollback pattern.
The stage ID is ordinarily unavailable to the public client until staging
finishes, so that path has lower reachability than the confirmed cancel/confirm
race. Ownership checks precede every modified R2 path, and expired confirmation
still returns 410 while owner cancellation remains available.

Six lifecycle tests exercise actual isolated local D1/R2, including barriers for
the two races, a D1 trigger rejecting the final restored update, deletion
failures and expiry. Five tests failed against the old implementation; all 13
focused recovery tests across three files passed after the fix. Independent
review found no blocking recovery defects. No cloud learner data was accessed.

These fixes do not establish automatic removal of abandoned stages. The source
still has no scheduled expiry sweep, and actual R2 lifecycle configuration is
unverified. Confirmation expiry is an access deadline, not evidence of physical
deletion. A prefix-scoped retention policy still needs separate approval and
synthetic cloud deletion/sentinel evidence.

## Terminology gate corrections

Known aliases are checked regardless of casing. Registry ID-shaped strings are
also detected regardless of casing, with canonical casing distinguished from an
unknown ID. Static JSX headings and labels now resolve literal expressions,
fragments and nested native elements before comparing names. Known branded
names inside those static labels receive the same canonical spelling check.
Dynamic labels and custom-component render behavior are not inferred.

The current-source scan exposed two displayed uses of the registered alias
`Wait Step` in one snapshot portability exercise. Only its label and matching
outcome description now say "Handle removal of a Wait action". Expected JSON,
grading rules, skill IDs and learner data are unchanged. The official
[Wait action guide](https://help.gohighlevel.com/support/solutions/articles/155000002470-workflow-action-wait)
names the menu action Wait. Content version `2026.10.12.1` and its generated
lock bind that copy correction.

Nine end-to-end controls cover direct, expression and nested labels, alias
casing, known/unknown ID casing and branded labels, plus dynamic/canonical/generic
prose acceptance. Seven controls reproduce misses on the original gate; all nine
pass after correction. Negative controls now scan only their fixed fixtures,
while the normal gate separately scans the whole source. Reusing non-global term
patterns reduces repeated work without changing matches or test deadlines. The existing title-case phrase
heuristic is retained, and generic instance prose is not forced into product
label casing. The controls now run in the normal terminology gate.

GHL-005/GHL-010 remain PARTIAL. Arbitrary unprefixed names, contextual generic
exceptions, MDX/rendered label coverage and current official-source review are
not exhaustively certified by this static JSX/source scan.

## Approved dependency patches

The user approved applying and installing the reviewed patch proposal for local
verification. Eight overrides scoped to existing majors patch six existing
transitive packages: brace-expansion 5.0.12/2.1.7, fast-uri 3.1.8,
serialize-javascript 7.1.2, sharp 0.35.5, source-map-js 1.2.2 and undici
7.29.1/8.10.2. Thirty-five locked versions change: nine target instances and
26 Sharp/platform dependencies; no package path is added or removed.

Cloudflare Vitest pool, Vite plugin, Wrangler, Miniflare, workerd, Vitest,
application dependency versions and direct ranges are retained. No automatic
Worker test-pool downgrade or gate weakening is applied. The actual installed
tree reports zero npm advisories. A synthetic native Sharp PNG encode/decode
smoke test passed on Windows. Other platforms require CI validation; a registry
audit is not proof of absence of vulnerabilities or deployed exploitation.

## Verification and retained release boundary

Node 22.23.3 local verification passed: typecheck, lint, formatting, all 2,211
unit tests across 182 files, 15 adversarial cases, control-document/status and
source-security checks, content/terminology/freshness, 59 screen-state controls,
screen inventory, voice checks and the build. The full unit rerun used the local
CLI option `--maxWorkers=2`; repository pool settings and deadlines are unchanged.
After final fixture isolation, the two affected test files passed again (5 tests)
and all nine terminology controls passed in approximately one second.

The initial full run's two deadline failures remain recorded: the terminology
control scanned the whole repository under concurrent load, and the unchanged
privacy collector's child-process deadline also expired. Neither test nor its
deadline was weakened. The first local accessibility attempt encountered an
occupied default port and failed before collecting any scans. The unchanged gate
then passed on an owned local server at port 4208, whose health response confirmed
content version `2026.10.12.1`: 89 axe scans, zero reported violations and the
detected negative control. Its 173 incomplete-node occurrences still require
judgment. The corrected exercise label was rendered and inspected at 1440px and
390px without horizontal overflow. This local evidence is distinct from the
required new exact-head CI/Preview publication.

The requirement matrix is unchanged: 313 registered, 284 PASSED, 8 IN_PROGRESS,
5 PARTIAL, 12 IMPLEMENTED_UNVERIFIED, 2 DEFERRED and 2 NOT_STARTED; 24 P0/P1 rows
remain open. Human visual/device/microphone/provider and real-GHL acceptance
remain parked. Production, merges, stacked bases and repository visibility are
unchanged. No provider credits were spent and no migration was changed.

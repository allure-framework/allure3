# Identity compatibility

Context: [PR #903](https://github.com/allure-framework/allure3/pull/903).

## Canonical identity

Every generation calculates `testCaseHash`, `parametersHash`, and `retryHash`
from result data. Adapter-provided hashes and `historyId` cannot override them.
Parameter hashing uses the stored, unredacted parameters, including hidden and
masked values. Exact duplicate pairs collapse; excluded parameters do not
participate.

Canonical results always contain the identity fields. Missing components are
stored explicitly as `null`:

```text
testCaseHash: string | null
parametersHash: string
environmentHash: string | null
retryHash: string | null
```

Results sharing a `testCaseHash` also share the current-report `TestCase`.
The first nonempty explicit `ALLURE_ID` or `AS_ID` is retained on that object;
later missing or different values do not replace it.

Results and new history points store environment **IDs**. Display names are
presentation data from the current environment configuration. The reserved
`default` ID contributes no environment hash. Environment matchers do not
receive `ALLURE_ID` or `_fallbackTestCaseId`, so identity-migration labels cannot
change the resolved environment or its hashes.

Retries and history use environment-specific `retryHash`. Features explicitly
grouping executions across environments (Awesome categories and environment
tabs, TestOps categories, and Jira entries) use
`testCaseHash + "." + parametersHash` instead.

## Reading old history

Previous reports, summaries, and persisted history points are immutable.
Compatibility is a read operation, not a migration or rewrite:

1. Look for the current `retryHash` in each historical point.
2. Only after a miss, try an explicitly supplied legacy ID from
   `sourceMetadata.legacyHistoryId`.
3. Legacy fallback is allowed only for current results with canonical identity
   and no named environment, and historical entries with absent/default environment.
4. Skip aliases claimed by different current retry hashes, or colliding with
   another current canonical key. Ambiguous aliases are ignored silently.

This is an explicit compatibility exception to the canonical-model rule in
section 18 of the identity specification: adapter-provided `historyId` remains
ignored for canonical identity and retry grouping, but may be retained as a
read-only secondary lookup key for the default environment.

The old core history-ID algorithm is not restored. If no matching legacy value
is supplied, history under a different old key is not recovered. No legacy key
is synthesized from `_fallbackTestCaseId`; that label is reserved for catalog
resolution and ignored when no catalog exists.

New history is always written under canonical `retryHash`. Retention is
unchanged; with unlimited history, old points may remain indefinitely.

Historical flags are updated explicitly after input batches, before batched
test-result events reach subscribers, and before realtime or final report
generation, not by store getters. With history configured,
`flaky` and `transition` are recomputed from all selected canonical and legacy
points using the same chronological sequence and existing history window.
Without a history source, the incoming `flaky` field is preserved. Dumps
serialize the current result fields directly, without a separate original-value
registry.

## Dumps and external schemas

Dump generation and restoration support the **same-version** workflow. Dumps
retain explicit source compatibility metadata, but derived identity indexes are
rebuilt rather than trusted. Restored resolutions are reclassified using the
current configuration. Older-version dump conversion is not part of this bridge.
If restored input nevertheless contains a top-level legacy `historyId`, it is
preserved as extra input data while canonical identity fields are recalculated;
it is not part of the public `TestResult` model.

Generated report data uses canonical identity fields:

- `plugin-allure2` is an Allure 3 report with Allure 2 styling, not an adapter for
  the Allure 2 data model. Its test-case JSON uses `retryHash`, not `historyId`.
- Allure Agent output emits `retry_hash` (or `null`), without a duplicate
  `history_id`. Loading an existing agent manifest may normalize its old
  `history_id` field to `retry_hash`; this is input handling, not dual output.

Rereading raw result files calculates new identities regardless of which legacy
fields those files contain.

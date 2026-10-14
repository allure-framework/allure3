# Flaky test detection

Allure can infer flakiness from a test's current execution and matching history.
Choose an algorithm in `allurerc.mjs` (or another supported configuration format):

```js
import { defineConfig } from "allure";

export default defineConfig({
  historyPath: "./history.jsonl",
  flakyDetection: {
    algorithm: "retry-failure-rate", // "status-changes" is the default
    retryFailureThreshold: 0.1,
    historyDepth: 0, // unlimited (default)
    stabilizationPeriod: 5,
    includePassedTests: true,
  },
});
```

`includePassedTests` defaults to `false`: inferred flaky badges normally apply
only to currently failed or broken tests. Set it to `true` to flag tests that
pass after unreliable attempts. An explicit flaky flag from the test framework
is preserved regardless of inference settings.

## Scopes and terminology

- **Report run:** one collection of results used to generate a report, containing
  results for many tests.
- **Test execution:** all attempts of one test in one report run, for the same
  test identity, parameters, and environment.
- **Attempt:** one try of that test: the initial try or an individual retry.
- **Historical execution:** that same test's execution in an earlier report run.

For example, `[failed, broken, passed]` is **one test execution with three
attempts**: an initial failure, a broken first retry, and a passing second retry.
Its final status is `passed`, but retry failure rate counts all three attempts,
not just that final status.

The retry failure cutoff applies **once per test**, after pooling complete
attempts from its current execution and selected historical executions that
remain after gap and stabilization resets. It does not apply separately to each
retry or execution, and different tests are never pooled together. The stability chart has a separate, group-level threshold.

## Algorithms

### Status changes (default)

`algorithm: "status-changes"` is a deterministic heuristic using **final statuses
across report runs**, not individual retries. After the latest history gap or
stabilization block, more than one status change indicates flakiness, except a
single `passed → failed → passed` or `passed → broken → passed` recovery.
Consecutive identical final outcomes clear earlier instability.

Use this option when retry data is unavailable or you prefer a rule-based
classification. `retryFailureThreshold` has no effect on this algorithm.

### Retry failure rate

`algorithm: "retry-failure-rate"` measures the fraction of observed attempts
that failed or broke, within a test's post-reset window. History selection,
stabilization, and the final cutoff are separate steps.

#### 1. Select history and apply resets

First, select the raw history slice, include the current execution, and apply
stabilization and gap rules. These rules are described
[below](#data-and-history-window). Stabilization requires consecutive executions
with the **same complete, uniform attempt sequence**: every attempt within an
execution has the same status. A completed streak discards **the streak itself
and all older executions**. Only subsequent executions supply evidence. If
current belongs to that uniform streak, the post-reset window is empty and the
test is unassessed. Mixed sequences such as `[failed, passed]` or
`[failed, broken]` break the streak and keep contributing to the calculation,
even when the same mixed sequence repeats.

Every remaining execution with complete attempt information supplies counts,
including uniform failures such as `[failed]`, `[failed, failed]`, and
`[broken, broken]`. Outcomes can differ between separate executions: an
order-dependent test can alternate passing executions with `[failed, failed]`
executions and still be classified flaky.

The significant statuses are `passed`, `failed`, and `broken`. `skipped` and
`unknown` attempts do not contribute to either count. No cutoff is applied to
an individual execution.

#### 2. Pool all complete attempts for this test

Add the attempts from every complete execution in the post-reset window:

- `F`: the **total** number of `failed` and `broken` attempts, including initial
  attempts and retries.
- `S`: the **total** number of `passed` attempts, including initial attempts and
  retries.

For example, `[failed, broken, passed]` contributes `F = 2` and `S = 1`;
`[passed]` contributes `F = 0` and `S = 1`. A `[failed, broken, failed]`
execution contributes `F = 3` and `S = 0`.

Compute **one rate for this test** from the pooled totals:

```text
retry failure rate = F / (F + S)
```

This is not an average of per-execution percentages, and it is not the
percentage of executions that were mixed. Each significant attempt contributes
one observation. An execution with several failed retries therefore supplies
more failure evidence than one with a single failed attempt. Clean passing
executions supply passing observations that reduce the pooled rate.

If the post-reset window contains no counted attempts, there is no rate to
compare: the test is **unassessed**, not stable. A short uniform failure window
has a 100% failure rate and can be flagged before stabilization. Long enough
identical **uniform** sequences clear the evidence: for example, repeated
`[passed, passed]`, `[failed, failed]`, or `[broken, broken]`. Repeated mixed
sequences do not clear their evidence.

#### 3. Compare the pooled rate with the per-test threshold

A test is inferred flaky when its pooled `F / (F + S)` is **strictly greater than
`retryFailureThreshold`**. The threshold must be a finite number in `[0, 1]` and
defaults to **0.1**, meaning a maximum acceptable failed/broken fraction of **10%
of the counted attempts for that test**. Equality does not mark it flaky.

The threshold is applied once, after counting current and historical attempts.
It is not a cutoff per retry, a cutoff per execution, a minimum number of
retries, or a percentage of all tests in the report.

#### Worked examples

Each example concerns **one test**, with executions shown oldest to newest and
the current execution last. Assume the attempt information is complete and all
shown executions remain in the post-reset window. For the next two examples,
set `stabilizationPeriod: 10` so nine consecutive passes do not reset it.

Nine historical `[passed]` executions followed by current `[failed, passed]`
supply `F = 1` and `S = 10`: `1 / 11 ≈ 9.09%`, below the default cutoff. The
current execution alone has a 50% failure fraction, but the cutoff is applied to
the **pooled 9.09%**, not to that execution in isolation.

With the same nine clean historical executions, current
`[failed, failed, failed, failed, passed]` supplies `F = 4` and `S = 10`:
`4 / 14 ≈ 28.57%`, above the default cutoff. Additional observed failures matter,
even though both examples have only one mixed execution.

With the default `stabilizationPeriod: 5`, those nine clean passes instead form
a completed stabilizing block and are discarded. The current `[failed, passed]`
then supplies the only observations: `1 / 2 = 50%`, above the default cutoff.
Stabilization can therefore remove passing observations from the denominator,
not only failure observations.

These two three-execution histories also have the same number of mixed
executions, but different pooled rates:

| Selected executions, oldest to newest | Total `F` | Total `S` | Pooled rate |
| --- | --- | --- | --- |
| `[failed, broken, passed]`, `[passed]`, `[failed, passed]` | 3 | 3 | `3 / 6 = 50%` |
| `[failed, passed]`, `[passed]`, `[failed, passed]` | 2 | 3 | `2 / 5 = 40%` |

Both exceed the default 10% tolerance, so both are inferred flaky. Different
rates do not necessarily produce different boolean flags. An illustrative
`retryFailureThreshold: 0.45` would classify only the first history as flaky;
45% is an example, not the default or a recommended universal cutoff.

Without history, a current `[failed, passed]` execution supplies `F = 1` and
`S = 1`, so its rate is 50%. A current `[failed, broken, failed]` supplies three
failures and no passes, so its rate is 100%. Either can be classified without a
previous matching execution. A current `[failed, failed]` also supplies two
failures and no passes, giving 100% before stabilization.

For an order-dependent example, `[passed]`, `[failed, failed]`, `[passed]`
supply `F = 2` and `S = 2`: a pooled 50% rate despite identical attempts in each
individual execution. Five consecutive `[failed, failed]` executions clear
themselves and older evidence, as do five consecutive `[passed]` executions.
Five consecutive `[failed, passed]` executions do **not** stabilize: they keep
contributing five failures and five passes, a 50% failure rate.

Only observed attempts are counted: a higher configured retry limit does not
itself change the rate, but additional failed attempts can increase it. The
ratio describes observed attempt-level failure frequency within the post-reset
window, not a retry-policy-independent prediction or a confidence level.
It is used internally; no numerical per-test score is stored in history or
report data.

## Data and history window

History is matched using existing test identity, parameters, and environment
(`retryHash`). Different environments or parameter sets are not pooled.

- Each historical execution stores all attempt statuses before its final
  attempt in `retries`, oldest first, and the final attempt's status in `status`.
  Retry failure rate reconstructs `[...retries, status]`, so the final attempt
  is counted once alongside the earlier attempts. The current execution's
  initial attempt and retries are included in the same pooled calculation.
- Historical records without `retries` have incomplete attempt information.
  Retry failure rate excludes them from its counts and stabilization signatures,
  but they still occupy positions in the raw history slice. Confirmed
  `retries: []` remains valid single-attempt evidence.
- Eligible executions finish as `passed`, `failed`, or `broken`. Currently
  skipped/unknown tests are unassessed.
- `historyDepth` defaults to **0 (unlimited)**: both algorithms use the whole
  history array. A positive integer selects `history.slice(0, historyDepth)`
  before any filtering. Skipped/unknown, incomplete, and duplicate-current
  entries occupy positions in that slice; excluded entries are not replaced
  with older results. Current is included separately and does not consume the
  limit. **−1** disables inference. Gap and stabilization rules still apply.
- A **missing entire test result in a run** ends usable history. A gap can
  represent quarantine or removal, so older evidence is not carried across it.
- `stabilizationPeriod` defaults to **5**. Retry failure rate compares only
  complete **uniform** attempt sequences, including their retry count.
  `[failed]` and `[failed, failed]` differ. Mixed attempts and incomplete
  historical attempts break the streak.
- A completed uniform streak discards **the entire streak and all older
  evidence**. Further identical uniform executions stay within that cleared
  block; counting resumes when a different complete sequence appears. Mixed
  executions keep contributing, including repeated `[failed, passed]` and
  `[failed, broken]` sequences.
- With positive `historyDepth`, configuration requires
  **`stabilizationPeriod < historyDepth`**. The configured period is never
  silently reduced. Omitted values use their defaults for validation, so
  `historyDepth: 5` is incompatible with the default period of 5;
  `historyDepth: 6` is valid. Unlimited and disabled history are exempt.
- With `stabilizationPeriod: 1`, a uniform current execution resets the window;
  a mixed current execution still supplies counts.

Window selection and stabilization happen **before** counting all complete
executions. Uniform failures are counted whenever they remain after the resets.
Quarantine resets history only when the test is absent from a report run;
marking it muted without removing its result does not create a history gap.
The status-change heuristic uses the same history-window limits but compares
final statuses for stabilization.

## Stability distribution chart

The chart supports both algorithms independently of the report's badge settings.
Configure it in the Awesome plugin's `charts` array or Dashboard's `layout` array:

```js
{
  type: "stabilityDistribution",
  algorithm: "retry-failure-rate",
  retryFailureThreshold: 0.1,
  // Omit limit for unlimited history.
  stabilizationPeriod: 5,
  groupBy: "feature",
  threshold: 90,
}
```

`algorithm` defaults to `"status-changes"` here too. Set the same algorithm,
per-test cutoff and window settings explicitly on both consumers when you want
comparable classifications; chart options do not inherit `flakyDetection`.

The two thresholds apply at different scopes and use different units:

- **`retryFailureThreshold`** (default **0.1**, range `[0, 1]`) classifies each
  test using its own pooled attempt counts. It has the same per-test meaning
  as in `flakyDetection`.
- **`threshold`** (default **90**, range `[0, 100]`) marks a chart group unstable
  when the percentage of its assessed tests classified stable is below that
  value. It does not change any test's flaky classification.

The chart first classifies tests independently, then shows **the percentage of
assessed tests classified stable within each group**. It neither pools attempts
from different tests nor averages their retry failure rates. The calculation
truncates to two decimal places:
`Math.floor((stable * 10000) / assessed) / 100`.

For example, two stable tests and one flaky test give a group stability rate of
66.66%, below the default group threshold of 90%, regardless of the individual
tests' numerical retry failure rates.

Unassessed tests do not contribute to the denominator. With retry failure rate,
a fully reset test is unassessed, including a clean-passing test whose current
execution completes an identical streak. A group with no assessed tests is
omitted. Uniform failure windows are assessed as unstable before stabilization
when their rate exceeds the cutoff. Explicitly reported flaky tests count as
unstable even when inference would be unassessed. Eligible passed tests are
assessed independently of `includePassedTests`; the chart honors its own
`skipStatuses` setting.

Omitting chart `limit` selects **the whole history array** by default, subject to
the same gap and stabilization rules. A positive `limit` selects
`history.slice(0, limit)` before filtering, exactly like a positive
`historyDepth`. Chart configuration likewise requires
**`stabilizationPeriod < limit`** for a positive limit, using defaults when
omitted. Unlike `historyDepth: 0`, chart **`limit: 0` disables the chart**.

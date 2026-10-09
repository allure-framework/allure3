# Flaky test detection

Allure can infer flakiness from a test's current execution and matching history.
Choose an algorithm in `allurerc.mjs` (or another supported configuration format):

```js
import { defineConfig } from "allure";

export default defineConfig({
  historyPath: "./history.jsonl",
  flakyDetection: {
    algorithm: "pfs", // "status-changes" is the default
    pfsThreshold: 0.1,
    historyDepth: 10,
    stabilizationPeriod: 5,
    includePassedTests: true,
  },
});
```

`includePassedTests` defaults to `false`: inferred flaky badges normally apply
only to currently failed or broken tests. Set it to `true` to flag tests that
pass after unreliable attempts. An explicit flaky flag from the test framework
is preserved regardless of inference settings.

## Algorithms

### Status changes (default)

`algorithm: "status-changes"` is a deterministic heuristic using **final statuses
across report runs**, not individual retries. After the latest history gap or
stabilization block, more than one status change indicates flakiness, except a
single `passed → failed → passed` or `passed → broken → passed` recovery.
Consecutive identical final outcomes clear earlier instability.

Use this inexpensive option when retry data is unavailable or you prefer a
rule-based classification. It does not estimate a probability. `pfsThreshold`
has no effect on this algorithm.

### Probabilistic Flakiness Score (PFS)

`algorithm: "pfs"` uses a Bayesian adaptation of Meta's
[probabilistic flakiness model](https://engineering.fb.com/2020/12/10/developer-tools/probabilistic-flakiness/).
It estimates **the probability of an attempt failing when the test is in a good
state**, rather than the overall observed failure rate.

A run has a latent good/bad state shared by its attempts:

- In a **good state**, attempts independently fail with probability `p`.
- In a **bad state**, every attempt fails; `q` is the probability of this state.

For a run with `F` failing and `P` passing attempts, its likelihood is:

```text
P > 0: (1 − q) × p^F × (1 − p)^P
P = 0: q + (1 − q) × p^F
```

A recovered failure therefore supplies evidence of flakiness; an all-failing
run may instead represent genuinely broken code. Allure multiplies these
likelihoods across the selected runs, applies priors `p ~ Beta(1, 19)` and
`q ~ Beta(1, 1)`, integrates out `q`, and uses the posterior mean of `p` as PFS.
Integration is deterministic; no sampling or random seed is required.

A test is inferred flaky when **PFS is strictly greater than `pfsThreshold`**.
The threshold must be a finite number in `[0, 1]` and defaults to **0.1**.

These priors and the cutoff are **Allure policy choices, not values prescribed
by the article**. The low-flakiness prior has mean `1 / 20 = 0.05`; the default
cutoff is twice that baseline. For example, two runs each containing
`[failed, passed]` give `Beta(3, 21)`, whose mean is `0.125`, exceeding the default
cutoff. One such run gives `2 / 22 ≈ 0.091`, below it. Calibrate the cutoff to your
retry policy and tolerance for false positives; it is not a confidence level or
a guaranteed error rate.

PFS is calculated on demand to classify tests, not stored in history. All-failing
evidence alone can leave flakiness uncertain because `p` and `q` are confounded.
The model assumes a constant state within a run and independent attempts given
that state; environment changes during retries can violate this assumption.

## Data and history window

History is matched using existing test identity, parameters, and environment
(`retryHash`). Different environments or parameter sets are not pooled.

- Each historical run stores earlier attempt statuses in `retries`, oldest first,
  and the final outcome in `status`. PFS reconstructs `[...retries, status]` and
  includes the current run's attempts, even without a configured history file.
- Legacy history without `retries` is treated as `retries: []`; unavailable retry
  evidence is not reconstructed. Such results still participate as single attempts.
- Eligible runs finish as `passed`, `failed`, or `broken`. Within those runs,
  `failed` and `broken` both count as failures; skipped and unknown attempts do
  not contribute to the likelihood. Currently skipped/unknown tests are unassessed.
- `historyDepth` defaults to **10 previous comparable runs**, plus the current run.
  Skipped/unknown runs and duplicate current IDs do not consume the limit.
  **0** means all comparable history since the latest gap; **−1** disables inference.
  A PFS estimate requires at least two comparable attempts in the selected window.
- A **missing entire test result in a run** ends usable history. Missing `retries`
  does not. A gap can represent quarantine or removal, so older evidence is not
  carried across it.
- `stabilizationPeriod` defaults to **5**. PFS compares complete ordered attempt
  sequences, including the final status, rather than only final outcomes:
  `[failed, passed]` and `[passed]` differ, as do `[failed, passed]` and
  `[broken, passed]`. A qualifying streak discards older evidence but retains the
  **entire latest identical streak**. Repeated failed-then-passed runs therefore
  remain evidence of flakiness; repeated clean passes reduce the score.
  For bounded history, the effective period cannot exceed `historyDepth + 1`.

PFS costs more than the status-change heuristic, particularly with unlimited
history or many retry attempts. Prefer a bounded history window for large reports.

## Stability distribution chart

The chart supports both algorithms independently of the report's badge settings.
For example, configure this chart in the Awesome plugin's `charts` array or the
Dashboard plugin's `layout` array:

```js
{
  type: "stabilityDistribution",
  algorithm: "pfs",
  pfsThreshold: 0.1,
  limit: 10,
  stabilizationPeriod: 5,
  groupBy: "feature",
  threshold: 90,
}
```

`algorithm` defaults to `"status-changes"` here too. Set the same algorithm,
score cutoff, and window settings explicitly on both consumers when you want
comparable classifications; chart options do not inherit `flakyDetection`.

The chart continues to show **the percentage of assessed tests classified
stable within each group**, not average PFS. Its `threshold` is a group stability
percentage (default **90**); `pfsThreshold` is the per-test probability cutoff.
Insufficient evidence is excluded unless the framework explicitly reported the
test flaky. The chart assesses eligible passed tests independently of
`includePassedTests` and honors its own `skipStatuses` setting.

Unlike `historyDepth: 0`, chart **`limit: 0` disables the chart**. PFS changes the
classification feeding existing bars, not the chart's layout or percentage scale.

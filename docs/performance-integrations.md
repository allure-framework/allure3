# Performance integrations

Allure 3 uses Allure JS 3.15 integrations for native Node.js measures and AQL benchmarks.

## Generator measures

`ALLURE_PERF_METRICS=1` enables native measures for generator stages. The generator only creates measures with stable metric keys and clears its unique marks. It does not install an observer or an Allure runtime, collect Allure results, write metric files, or insert its own measurements into report history.

Instrumentation belongs to the dedicated performance probe, not to ordinary core unit tests. Only `vitest.perf.config.ts` installs the performance setup; helper tests may create synthetic native measures, but do not publish them into the CI report. The probe setup starts an `allure-node-performance` session in `beforeEach` and stops it in `afterEach`, while the test runtime context is active. File-level `afterAll` publication does not reach the reporter in the current Allure Vitest/Vite+ combination. Tests sharing a worker must not run concurrent instrumentation sessions; parallel workers have independent observers. The configured Allure test reporter provides the runtime and writes collected measures as `<uuid>-metric.json` batches (`<uuid>-perf.json` with older reporters) in its results directory. Application measures remain in the native timeline; profiling does not clear entries belonging to other callers.

A standalone `allure generate` invocation no longer writes self-profiling files, even with the flag enabled. Integration calls without a configured runtime follow Allure JS's standard no-op behavior. The old workload counters and aggregated `.totalMs`/`.avgMs` metrics have been removed; high-frequency store and reader operations are not measured individually.

## CI report generation probe

CI runs a dedicated core probe with the normal Allure reporter:

`yarn workspace @allurereport/core test --config=vitest.perf.config.ts`

The probe is excluded from normal test discovery. It restores downloaded result dumps and generates an unpublished report in the same process as the test runtime. `ALLURE_PERF_DUMPS` may override the default repository-relative `allure-results-*/*.zip` input glob; missing archives fail the probe. The native `allure.total` measure includes restore and generation.

`ALLURE_RESULTS_DIR` selects the reporter output directory. CI copies only its `*-metric.json` files into the main report input, excluding the probe's own test result. The main report reads these metrics through the normal reader and persists them in history. There is no self-profiling snapshot or second generation of plugin files. Reports include all samples from new and legacy files. When combining inputs, include each recording once.

## AQL benchmarks

AQL performance tests use Tinybench 6 and `allure-tinybench` with fixed iteration counts, no timed loop, and no warmup. Their existing latency thresholds remain assertions on a completed task's mean `period` in milliseconds. Each scenario publishes a stable `aql.*` key through the test reporter's runtime.

The harness changed from a manual timing loop to Tinybench. Keys and thresholds are retained, but historical values are not guaranteed to be directly comparable across the migration.

Use separate `Bench` instances for independent concurrent runs. Outside a configured reporter, the integration uses the standard no-op runtime and does not write files itself. Titles, units, groups, and preferred value direction belong in `allurerc.mjs`.

## CLI bundle size

The bundle-size workflow measures the installed CLI footprint with `scripts/allure-bundle-size.mjs`. It records
the Allure code, dependencies, and total size in bytes, plus the number of installed external packages. The count
includes direct and transitive packages and counts nested copies separately. Pull requests measure both the base
commit and the merge checkout on the same Linux runner. The report uses `metricMax` to check the code and dependency sizes against that
base measurement plus the allowed growth. Maintainers can use `/update-bundle-baseline` on same-repository PRs
to approve a larger increase. The command measures the merge checkout on the same runner type and publishes a
signed CI commit with the measured baseline. The approval applies to that PR and its current base and head.
Run the command again after either changes. For forks the command provides the measurement as an artifact.
Manual bundle-size runs use the checked-in baseline.

To generate a report against the checked-in baseline after `yarn build`:

```sh
node scripts/allure-bundle-size.mjs --allure-results ./out/bundle-size-results
yarn allure generate ./out/bundle-size-results --config .github/allure-bundle-size.config.mjs --output ./out/bundle-size-report
```

The report job also runs Playwright tests that build the CLI and generate Awesome reports in single-file and
directory modes. They use the public `metric()` API to record the size of the CLI's `dist` directory, the
single-file HTML, and the raw and gzipped JavaScript totals in the directory report. These measurements have
their own history. The bundle-size quality gate compares the installed CLI footprint.

A metric definition can set `timeline: false` to omit its measurements from the Awesome Timeline. Metrics are
included by default. This setting preserves the metric’s table, history, and quality-gate values. A hidden parent
still groups visible descendants in Timeline.

# Performance integrations

Allure 3 uses Allure JS 3.14 integrations for native Node.js measures and AQL benchmarks.

## Generator measures

`ALLURE_PERF_METRICS=1` enables native measures for generator stages. The generator only creates measures with stable metric keys and clears its unique marks. It does not install an observer or an Allure runtime, collect Allure results, write performance files, or insert its own measurements into report history.

Instrumentation belongs to the test run. Core's test setup starts one `allure-node-performance` session per sequential test and stops it in `afterEach`, while the test runtime context is active. File-level `afterAll` publication does not reach the reporter in the current Allure Vitest/Vite+ combination. Tests sharing a worker must not run concurrent instrumentation sessions; parallel workers have independent observers. The configured Allure test reporter provides the runtime and writes collected measures as `<uuid>-perf.json` batches in its results directory. Application measures remain in the native timeline; profiling does not clear entries belonging to other callers.

A standalone `allure generate` invocation no longer writes self-profiling files, even with the flag enabled. Integration calls without a configured runtime follow Allure JS's standard no-op behavior. The old workload counters and aggregated `.totalMs`/`.avgMs` metrics have been removed; high-frequency store and reader operations are not measured individually.

## CI report generation probe

CI runs a dedicated core probe with the normal Allure reporter:

`yarn workspace @allurereport/core test --config=vitest.perf.config.ts`

The probe is excluded from normal test discovery. It restores downloaded result dumps and generates an unpublished report in the same process as the test runtime. `ALLURE_PERF_DUMPS` may override the default repository-relative `allure-results-*/*.zip` input glob; missing archives fail the probe. The native `allure.total` measure includes restore and generation.

`ALLURE_RESULTS_DIR` selects the reporter output directory. CI copies only its `*-perf.json` files into the main report input, excluding the probe's own test result. The main report reads these metrics through the normal reader and persists them in history. There is no self-profiling snapshot or second generation of plugin files.

## AQL benchmarks

AQL performance tests use Tinybench 6 and `allure-tinybench` with fixed iteration counts, no timed loop, and no warmup. Their existing latency thresholds remain assertions on a completed task's mean `period` in milliseconds. Each scenario publishes a stable `aql.*` key through the test reporter's runtime.

The harness changed from a manual timing loop to Tinybench. Keys and thresholds are retained, but historical values are not guaranteed to be directly comparable across the migration.

Use separate `Bench` instances for independent concurrent runs. Outside a configured reporter, the integration uses the standard no-op runtime and does not write files itself. Titles, units, groups, and preferred value direction belong in `allurerc.mjs`.

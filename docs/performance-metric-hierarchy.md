# Performance metric hierarchy

An optional `parent` in the report's `performance.metrics` configuration associates a metric key with another metric key:

```ts
export default {
  performance: {
    metrics: {
      "report.generate": { title: "Generate report", unit: "ms", better: "lower" },
      "report.read": {
        title: "Read results", unit: "ms", better: "lower", parent: "report.generate",
      },
      "report.render": {
        title: "Render pages", unit: "ms", better: "lower", parent: "report.generate",
      },
    },
  },
};
```

Keys are matched exactly. Neither dots in a key nor membership in a metric group imply a parent. Each metric has at most one parent; multiple independent roots are allowed. A parent must be another key declared in `performance.metrics`. Empty/non-string parents, unknown parents, self-references and cycles are configuration errors, including when those metrics have no results.

The relationship is added to enriched `MetricSample` records, not to the raw performance result format. Allure JS integrations do not need to change. The current report configuration is authoritative for parent relationships, including when restoring metrics from a dump. Other restored metric metadata keeps the existing snapshot behavior.

Awesome keeps the configured `parent` in the existing `current` samples in `widgets/metrics.json`. There is no second serialized copy of the hierarchy. `buildMetricHierarchy(samples)` from `@allurereport/core-api` builds nodes containing `key` and `children`, with one node per observed key. The samples keep every individual result unchanged apart from configuration metadata. If a configured parent has no current result, its observed child is a root in this tree; the configured `parent` remains available on the sample. No missing measurement or value is fabricated. Existing reports without parent relationships keep their previous widget shape.

This is a hierarchy of **metric keys**, not a call tree. Repeated measurements of a key remain separate samples but share one structural node. Parent links do not prove timestamp containment or connect particular repeated invocations. Parallel or nested durations must not simply be added. This stage does not calculate inclusive/self time, normalize units, assign run-time percentages, or change metric history and quality gate calculations. It does not introduce a flame graph or change the Metrics page.

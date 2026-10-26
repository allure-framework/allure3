# Core

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The package includes a collection of utilities which are used across all Allure packages.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/core
yarn add @allurereport/core
pnpm add @allurereport/core
```

## Configuration expressions

Use `allurerc.yml` as the primary configuration file. YAML supports multiline
[CEL](https://cel.dev/) predicates wrapped in `${{ ... }}` in `hideLabels` entries,
`categories[].matchers`, and `environments.<id>.matcher`. Expressions are parsed and checked once when
resolving configuration, then evaluated synchronously during report generation.
They must return a boolean: `true` hides a label or matches a category or environment.

```yaml
hideLabels:
  - owner
  - "${{ name.startsWith('internal_') }}"
  - "${{ name.matches('^private_[0-9]+$') }}"

categories:
  - name: Timeouts
    matchers: >-
      ${{ data.status == 'failed' && has(data.message) &&
          data.message.matches('timeout') &&
          data.labels.exists(l, l.name == 'layer' && l.value == 'api') }}
```

`hideLabels` predicates receive `name`, a string. Other entries remain exact, case-sensitive label
names. Prefix a literal `${{` name with an extra `$` to escape it, for example `$${{ owner }}` matches
the exact label name `${{ owner }}`. Labels starting with `_` are always hidden.

Category predicates receive a `data` map with `status`, `flaky`, and `labels` (a list of
`{ name, value }` maps), plus optional `message`, `trace`, `duration`, `transition`, and `environment`.
Absent optional fields are omitted; use `has(data.message)` before accessing them. Numeric input
values, including duration in milliseconds, are exposed as CEL doubles. Comparisons with integer
literals work; use double literals for arithmetic, for example `data.duration / 1000.0 > 5.0`.

Matchers can be a single expression, an object, or an array mixing them.
Array entries are OR conditions; combine conditions with `&&` inside an expression. The
`categories: { rules: [...] }` form and category grouping options are also supported. Existing object
matchers, their string regex patterns, and compatibility fields `messageRegex` and `traceRegex`
retain their existing behavior. Expression strings are not interpreted inside object matcher values
or unsupported configuration fields.

### Environment matching

Environment predicates receive `labels`, a list of `{ name, value }` maps. Match each name and value
on the same label to keep the conditions correlated. Repeated labels are preserved, not flattened;
for example, a test with `os=linux` and both `browser=firefox` and `browser=chrome` matches this rule:

```yaml
allowedEnvironments:
  - firefox_linux
environments:
  firefox_linux:
    name: Firefox on Linux
    variables:
      browser: Firefox
    matcher: >-
      ${{ labels.exists(l, l.name == 'browser' && l.value == 'firefox') &&
          labels.exists(l, l.name == 'os' && l.value == 'linux') }}
```

Matching uses the first matching environment in configuration order; no match falls back to
`default`. A forced top-level `environment` continues to take precedence over label matching.
Environment IDs, display names, variables, and `allowedEnvironments` retain their existing
normalization and validation. The predicate receives only label names and values, not descriptor
variables or process environment variables. Missing labels are supplied as an empty list.

Environment expressions must return a boolean. Invalid expressions and evaluation failures throw
with their configuration path; they do not fall through to another environment or `default`.

### Plugin options

Built-in plugin callback options accept CEL expressions wrapped in `${{ ... }}`:

| Plugin | Option | Context | Result |
| --- | --- | --- | --- |
| Awesome, Classic, Dashboard, CSV, Log, TestOps | `filter` | `test`, `env` | Boolean |
| Log | `qualityGateFilter` | `result`, `env` | Boolean |
| CSV | `fields[].accessor` | `test`, `env` | String or `null` |
| CSV | `sort` | `a`, `b`, `env` | Finite number |

`test`, `a`, and `b` are test-result data. `result` is a quality-gate validation result,
including fields such as `rule`, `success`, `actual`, and `message`. `env` contains defined
process environment variables captured during configuration resolution; later environment changes
do not affect these expressions. Optional fields should be guarded with `has(...)`. Inputs are
plain-data copies, not live plugin or store objects.

```yaml
plugins:
  export:
    import: '@allurereport/plugin-csv'
    options:
      filter: >-
        ${{ !has(env.ALLURE_EXPORT_STATUS) || test.status == env.ALLURE_EXPORT_STATUS }}
      fields:
        - header: Name
          accessor: name
        - header: Duration
          accessor: "${{ string(test.duration) + ' ms' }}"
        - header: Error
          accessor: "${{ has(test.error) && has(test.error.message) ? test.error.message : null }}"
      sort: '${{ a.duration - b.duration }}'
  log:
    options:
      filter: "${{ test.status == 'failed' }}"
      qualityGateFilter: '${{ !result.success }}'
```

CSV property-name accessors such as `name` stay literal. Use CEL for nested paths or computed
values, and convert numbers explicitly with `string(...)` for cells. `null` produces an empty
cell; CSV quoting and escaping are handled by the plugin. Comparators receive `a` and `b` and
return a negative number, zero, or a positive number. CEL integers are converted to JavaScript
numbers only when safely representable; non-finite results and other result types are rejected.
Omitting `sort` keeps the plugin's default ordering.

Expressions are compiled once before plugin construction and run synchronously. Syntax, evaluation,
and result-type errors include the option's configuration path and fail the affected operation,
like a thrown callback, rather than silently excluding tests. These options do not accept inline
JavaScript bodies. Native JavaScript callbacks remain available in JavaScript configuration.

Normalization applies only to the listed built-in implementations, including explicit package
imports and custom instance IDs. Third-party plugin options and unrelated strings are not
interpreted. Log result filtering controls displayed quality-gate outcomes, not their success or
exit status; test filters likewise select plugin output without changing the underlying results.

### Quality gates

Quality-gate configuration supports CEL filters, messages, and computed values in YAML and JSON.
Static `use` entries select built-in rules and override their messages; they do not reference modules,
exports, or external rule files. Custom validators use native functions in JavaScript configuration files.

```yaml
qualityGate:
  enabled: "${{ has(env.CI) && env.CI != '' }}"
  rules:
    - id: critical
      maxFailures: >-
        ${{ has(env.MAX_FAILURES) ? int(env.MAX_FAILURES) : 0 }}
      fastFail: true
      filter: >-
        ${{ test.labels.exists(l,
          l.name == 'severity' && l.value == 'critical') }}
    - minTestsCount: 100
  use:
    - rule: maxFailures
      message: "${{ 'Critical failures: ' + string(actual) }}"
      successMessage: 'No unexpected critical failures'
    - minTestsCount
```

When `use` is omitted, all built-in rules are available. Supplying `use` replaces that registry, so
include every rule referenced by `rules`, including built-ins. An empty list registers no rules.
Missing implementations fail configuration loading with the offending rule's path.

`rules[].filter` receives a plain-data `test` snapshot of the full test result and `env`, the same
configuration-time environment snapshot used by enablement and expected-value expressions. Filters
must return a boolean; guard missing fields and variables with `has(...)`. For example:

```yaml
filter: >-
  ${{ has(env.COMPONENT) && test.labels.exists(l,
    l.name == 'component' && l.value == env.COMPONENT) }}
```

Retries, ignored failures, ruleset order, `fastFail`, live-test deduplication, and final recomputation
retain their existing behavior.

`enabled` accepts a literal boolean or a boolean CEL expression; it defaults to `true`. `false`
skips the gate's rule resolution. Expected rule values, including leaves inside arrays or
objects, may use CEL expressions. Enablement and expected-value expressions run once during config
resolution against `env`, a snapshot of defined process environment variables. Missing variables are
absent, not empty strings; guard access with `has(env.NAME)` and convert strings explicitly with
`int(...)` or `double(...)`. `id` accepts a literal string and `fastFail` a literal boolean; filters
are evaluated per test. Unmarked strings stay literal.

When `enabled` is `false`, `allure quality-gate` prints a skip notice and exits successfully without
reading test results or evaluating rules. Explicit CLI thresholds override the configured gate and
still run validation. A missing quality-gate configuration remains an error.

To combine text and numbers in a rule's expected value, write a YAML object and put expressions on
individual fields. A single CEL object expression cannot mix text and numeric values. For example,
this keeps the metric name as text and reads its numeric threshold from `MAX_DURATION_MS`, defaulting
to `1000` when the variable is absent:

```yaml
qualityGate:
  rules:
    - metricMax:
        key: duration
        value: "${{ has(env.MAX_DURATION_MS) ? double(env.MAX_DURATION_MS) : 1000.0 }}"
```

Computed expected values must be JSON-compatible, with finite numbers and lossless conversion of CEL integers to JavaScript numbers. Built-in
values must also match the rule's expected domain: counts/duration are nonnegative numbers, success
rate is between 0 and 100, `newTests` is boolean, environment rules use strings/lists of strings, and
metric rules use a metric descriptor with a numeric `value`. Custom rules accept JSON-compatible
expected structures. Existing literal values and native JavaScript callbacks retain their contracts.

Omitting `use` retains the default built-ins. Supplying `use` selects exactly those rules; include
built-in names such as `maxFailures` explicitly alongside custom definitions. An object with a known
built-in `rule` may override `message` or `successMessage` without repeating its validator. Custom
rules require a name, validator, and failure message. Plain message strings are literal; marked CEL
messages must return strings. Message expressions receive only `expected` and `actual`, not mutable
state, test batches, or `env`.

#### Custom validators in JavaScript configuration

Use a `.mjs`, `.cjs`, or `.js` configuration file for custom validation. `validate` must be a function;
async callbacks and the existing state API remain available. For example, `allurerc.mjs` can define
an exact test-count rule:

```js
export default {
  qualityGate: {
    rules: [{ count: 100 }],
    use: [{
      rule: 'count',
      message: ({ expected, actual }) => `Expected ${expected}, got ${actual}`,
      validate: async ({ trs, expected, state }) => {
        const actual = Number(state.getResult() ?? 0) + trs.length;
        state.setResult(actual, []);
        return { success: actual === expected, actual, testResults: [] };
      },
    }],
  },
};
```

Callbacks retain their existing payload and lifecycle, including `metrics`, `previousHistory`, and
`environment`. Allure owns rule isolation, processed-test deduplication, and related ID accumulation.
A final full-snapshot evaluation starts with fresh state.

Built-in messages are inherited only when the built-in validator is inherited. A custom validator
requires its own failure message. If its success message is omitted, the engine uses its generic
success message.

#### Quality-gate errors and data

Quality-gate expression syntax/type errors fail configuration loading. Evaluation errors in filters,
computed values, and messages throw with a configuration-path diagnostic. Native validator callbacks
retain their existing exception behavior. CLI threshold flags still replace configured gate rules
and custom definitions; configuration is resolved before that replacement, so invalid enabled
configuration is still an error.

Computed expected values must be JSON-compatible: non-finite numbers, cycles, and non-plain data
are rejected.

### Regular expressions and escaping

Use the built-in `value.matches(pattern)` function. The pinned `@marcbachmann/cel-js` evaluator uses
Node.js `RegExp` without flags; matching is case-sensitive and searches anywhere unless anchored
with `^` and `$`. No extra flags argument or regex helper is registered.

Use YAML folded blocks (`>-`) for multiline predicates. Backslashes still need escaping inside CEL
strings, but folded blocks add no YAML escaping layer. This predicate matches `internal_42`:

```yaml
hideLabels:
  - >-
    ${{ name.startsWith('internal_') &&
        name.matches('^internal_\\d+$') }}
```

### Errors

Expressions must be wrapped in `${{ ... }}`. Missing or incomplete wrappers, invalid CEL, and
statically incompatible result types fail configuration loading with the configuration path.
Evaluation failures and dynamically incompatible result types also throw with that path. Only a
boolean `false` is a normal predicate non-match; errors do not fall through to other matchers.
Guard optional fields explicitly, for example `has(data.message) && data.message.contains('timeout')`.

Only plain-data snapshots are supplied to these matching predicates, with no environment variables,
filesystem, network, imports, plugin instances, or custom functions. Non-finite numbers, cycles, and
non-plain data are rejected.


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

### Quality gates

Quality-gate configuration supports CEL filters and computed values, plus inline JavaScript custom
validators. The same syntax works in JSON; YAML's block scalars are easier to read for scripts.
Configuration stays self-contained: `use` accepts built-in rule names or inline definitions, not
module/export references or external rule files.

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
    - count: 100
  use:
    - rule: maxFailures
      message: "${{ 'Critical failures: ' + string(actual) }}"
      successMessage: 'No unexpected critical failures'
    - rule: count
      message: "${{ 'Expected ' + string(expected) + ', got ' + string(actual) }}"
      validate: |
        const actual = Number(state.getResult() ?? 0) + trs.length;
        state.setResult(actual, []);
        return { success: actual === expected, actual, testResults: [] };
```

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
omits the gate before compiling its rules. Expected rule values, including leaves inside arrays or
objects, may use CEL expressions. Enablement and expected-value expressions run once during config
resolution against `env`, a snapshot of defined process environment variables. Missing variables are
absent, not empty strings; guard access with `has(env.NAME)` and convert strings explicitly with
`int(...)` or `double(...)`. IDs and `fastFail` stay literal; filters are evaluated per test. Unmarked
strings stay literal. CEL map literals are homogeneous; use YAML/JSON objects with individual expression values
for heterogeneous expected structures.

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

#### Inline validators

`validate` is a JavaScript **async function body**, without a surrounding function declaration and
without `${{ ... }}` delimiters. It is compiled once and may use `await`. The injected arguments are
`trs`, `expected`, `state`, `metrics`, `previousHistory`, and `environment`, matching the native
validator payload. For example, a failure counter can persist its accumulated value and related IDs:

```yaml
validate: |
  const failed = trs.filter(tr => ['failed', 'broken'].includes(tr.status));
  const actual = Number(state.getResult() ?? 0) + failed.length;
  const testResults = failed.map(tr => tr.id);
  state.setResult(actual, testResults);
  return { success: actual <= expected, actual, testResults };
```

Return `{ success, actual, testResults }`: `success` must be boolean, `actual` must be JSON-compatible,
and `testResults` must be a list of string IDs. `state.getResult()` returns this rule's previous value
or `undefined`; `state.setResult(value, ids)` stores the rule's value and related IDs through the existing state API. Allure
owns rule isolation, persistence and ID accumulation. Scripts retain the existing imperative state
lifecycle; state writes are not transactional. A final full-snapshot evaluation starts with fresh
state, as does a separately created live state. Metrics, previous history, and environment are
available directly; no parallel CEL state-transition format is needed.

**Inline scripts are trusted Node.js code, not a sandbox.** Like `actions/github-script`, they can
access globals, process environment variables, the filesystem/network, and dynamic imports. Do not
run configuration from untrusted authors.
No separate module reference, custom loader, or `require` helper is supplied.

#### Quality-gate errors and data

Quality-gate conditions and validators fail closed: syntax/type errors,
evaluation errors, malformed script results, and script exceptions stop gate evaluation with a
configuration-path diagnostic. They never silently drop a filter, disable a gate, or turn a broken
rule into success. Message syntax/type errors fail configuration loading. A runtime message error
warns once per configured message and falls back to the inherited message or a generic message with
the rule identity and outcome; it never changes the gate result. CLI threshold flags still replace
configured gate rules and custom definitions; configuration is resolved before that replacement,
so invalid enabled configuration is still an error.

Computed expected values and script result values must be JSON-compatible: non-finite numbers,
cycles, and non-plain data are rejected.

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


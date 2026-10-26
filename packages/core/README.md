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

Only plain-data snapshots are supplied to expressions, with no environment variables, filesystem,
network, imports, plugin instances, or custom functions. Non-finite numbers, cycles, and non-plain
data are rejected.


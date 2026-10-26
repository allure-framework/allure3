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
[CEL](https://cel.dev/) predicates wrapped in `${{ ... }}` in `hideLabels` entries and
`categories[].matchers`. Expressions are parsed and checked once when resolving configuration,
then evaluated synchronously during report generation.
They must return a boolean: `true` hides a label or matches a category.

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
or other configuration fields.

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

### Errors and resource use

A malformed expression, failed evaluation, or non-boolean result produces a warning containing its
configuration path and evaluates to `false`. Warnings are emitted at most once per configured
predicate. A runtime failure does not disable future evaluations. Invalid category predicates never
become match-all conditions; other OR matchers can still match.

Only plain-data snapshots are supplied to expressions, with no environment variables, filesystem,
network, imports, plugin instances, or custom functions. Non-finite numbers, cycles, and non-plain
data are rejected.

Expressions are not an execution-time sandbox: nested collection macros and regex backtracking can
be expensive.
Use trusted configuration and avoid pathological expressions and patterns.

# Core API

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The collection of interfaces and shared runtime utilities for core Allure Report entities.

## Expression utilities

Shared CEL utilities are implemented in `src/utils/expression.ts` and exported from this package:

```ts
import { compileExpression, compilePredicate, isExpression, CEL_DYNAMIC_TYPE } from "@allurereport/core-api";

const evaluate = compileExpression(
  "${{ test.name }}",
  'plugins["custom"].options.accessor',
  { test: "map" },
  { resultType: "string" },
);
const name = evaluate({ test: { name: "Example" } });
```

- `isExpression` recognizes the explicit `${{` prefix; compilation requires the complete wrapper.
- `compileExpression` declares allowed variables, parses/checks once and returns a reusable evaluator.
  Variable types are `string`, `map`, `list` or `CEL_DYNAMIC_TYPE` (`dyn`). Optional result types are
  `bool` and `string`, checked both at compilation and evaluation.
- `compilePredicate` compiles a boolean expression without coercing other results.
- Compilation and evaluation failures throw with the supplied configuration path.

Core configuration and plugin resolvers can reuse these utilities. Callers own their contexts,
evaluation timing and any specialized result adaptation, such as CSV cells and comparators.
Plugins can also use CEL directly when they need engine-specific behavior.

## Name expressions

`createNameContext()` captures the defined process environment variables and one UTC instant.
Its `date` fields are `iso`, `isoDate`, `year`, `month`, `day` and `unixMs`.
Reuse the resulting `NameContext` for all names in a configuration to keep their values consistent.

`resolveName(value, path, context)` evaluates a marked expression with `env` and `date`, requiring
a string result. Literal strings and `undefined` pass through unchanged. Both helpers and the
context type are exported from `@allurereport/core-api` and implemented in `src/utils/expression.ts`.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/core-api
yarn add @allurereport/core-api
pnpm add @allurereport/core-api
```

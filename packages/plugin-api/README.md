# Plugin API

> Collection of interfaces for Allure plugins

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The interfaces in the package describe the entities used for building Allure Plugins.

## Configuration expressions

A plugin can opt in to configuration expressions with optional static `configExpressions`
metadata. Declare supported fields beside the plugin class; Allure core handles evaluation
before constructing the plugin. Shared kinds need only a type import. Custom resolvers can reuse
the expression utilities in `@allurereport/core-api` or use CEL directly without importing core.

```ts
import type { Plugin, PluginExpressionFields } from "@allurereport/plugin-api";

export default class ExamplePlugin implements Plugin {
  static readonly configExpressions = {
    reportName: "name",
    filter: "testFilter",
    sections: { items: { title: "name" } },
  } as const satisfies PluginExpressionFields;

  constructor(readonly options: Record<string, any> = {}) {}

  start = async () => {
    console.log(this.options.reportName);
  };
}
```

`PluginExpressionFields` is a readonly map from option names to a `PluginExpressionKind`, a
`PluginExpressionResolver` function, or `{ items: PluginExpressionFields }` for arrays of objects.
Collections can be nested. Declare only
fields whose values follow the corresponding callback or string contract:

| Kind | Context | Normalized value |
| --- | --- | --- |
| `name` | `env`, `date` | String evaluated once during config resolution |
| `testFilter` | `test`, `env` | Deferred boolean test-result callback |
| `qualityGateFilter` | `result`, `env` | Deferred boolean quality-gate-result callback |

`resolvePluginExpression`, exported from this package and implemented in `src/utils/expression.ts`,
dispatches shared kinds and custom resolvers using the supplied configuration path and `NameContext`.
The name context helpers are exported from `@allurereport/core-api`.

Marked strings use the full `${{ ... }}` syntax. Ordinary names stay literal; native callbacks
pass through. Filter strings must be full expressions.
Environment variables are captured during config resolution. See the [core expression documentation](../core/README.md#configuration-expressions)
for context fields, date values and error semantics.

Metadata is the opt-in regardless of package namespace, aliases, explicit imports or re-exports.
Undeclared fields and constructors without metadata stay untouched, including expression-looking
strings. Normalization does not mutate the input options, and preserves unchanged option and
collection-entry identity. Syntax, evaluation and result-type failures identify the configured
instance and field. The exported `PluginConstructor` type describes the constructor and its optional
metadata; existing plugins do not need to implement a new instance interface.

### Custom resolvers

A function declaration owns the field's string interpretation and output contract. Core calls it
with the configured string and a `PluginExpressionContext` containing `path` (the actual instance
and nested field) and `env` (captured during config resolution). Non-string values, including native
callbacks, pass through without invoking the resolver.

```ts
import type { PluginExpressionFields } from "@allurereport/plugin-api";
import { resolveAccessor, resolveComparator } from "./expressions.js";

// Attach this map to the plugin constructor's static configExpressions property.
export const configExpressions = {
  filter: "testFilter",
  sort: resolveComparator,
  fields: { items: { header: "name", accessor: resolveAccessor } },
} as const satisfies PluginExpressionFields;
```

The plugin's `expressions.ts` owns field interpretation, context selection, callback construction
and result adaptation. It can reuse `compileExpression`, `compilePredicate`, `isExpression` and
`CEL_DYNAMIC_TYPE` from `@allurereport/core-api` for wrapper handling, declared-variable checks,
compilation and path-specific errors. See the [expression utilities](../core-api/README.md#expression-utilities).

Compile in the resolver, not inside the returned callback. Capture the supplied `env` rather than
reading `process.env` during callback execution. A plugin can instead depend on CEL directly and
construct its own `Environment`; in that case it owns wrapper validation and both compilation and
evaluation diagnostics, including the supplied `path`.

For example, the CSV plugin declares its own accessor and comparator functions. It preserves
property-name accessors, maps a `null` cell result to `undefined`, and converts comparator integers
while rejecting non-finite or unsafe results. These are CSV contracts, not global expression kinds.
CSV reuses the core-api compiler and imports CEL directly for engine-specific values such as `UnsignedInt`.
The plugin API provides metadata interfaces and plugin expression dispatch, not a compiler service
or custom-kind registry.

## Internal report utilities

The `@allurereport/plugin-api/internal/report` subpath is reserved for Allure's bundled report generators and frontends. It is not part of the supported plugin API and may change without a major version bump. Third-party plugins should use the documented API entry points.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-api
yarn add @allurereport/plugin-api
pnpm add @allurereport/plugin-api
```

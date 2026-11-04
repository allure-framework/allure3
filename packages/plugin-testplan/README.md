# Testplan Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The plugin generates Allure Testplan file which can be used by Allure integrations to define which tests should be executed.

## Generated format

By default, generated plans retain version `"1.0"` and contain both `tests` and `mutedTests` arrays:

```json
{
  "version": "1.0",
  "tests": [
    { "id": "42", "selector": "suite#mutedFailure" },
    { "selector": "suite#regularFailure" }
  ],
  "mutedTests": [
    { "id": "42", "selector": "suite#mutedFailure" },
    { "selector": "suite#mutedPassed" }
  ]
}
```

- `tests` follows the configured `filter`, which selects failed and broken results by default.
- `mutedTests` includes all results whose boolean `muted` flag is `true`, regardless of their status or the configured filter. A muted resolution without that flag does not qualify.
- Entries use an optional `id` from the `ALLURE_ID` label and an optional `selector` from `runSelector`, falling back to `fullName`. Results without either identifier are omitted.
- Overlap is intentional: a muted failed result can appear in both lists.
- Either array can be empty, but both keys are always present. A muted-only plan has `tests: []`.
- Generation is skipped only when neither collection has candidate results, before mapping identifiers.

The `allure testplan` command uses this same format. Honoring `mutedTests` requires consumer support; generating the list alone does not suppress results or change execution filtering.

## Muted-only generation

Use `allure testplan ./allure-results --muted-only` to generate only the muted list:

```json
{
  "version": "1.0",
  "mutedTests": []
}
```

This mode omits `tests` entirely and always writes a file, even when no muted results are found. Muted results are selected by the boolean `muted` flag regardless of status; the `filter` option is not applied. Set the plugin option `mutedOnly: true` for the same behavior through configuration. Without this option, the default format and generation rules above apply.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-testplan
yarn add @allurereport/plugin-testplan
pnpm add @allurereport/plugin-testplan
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    testplan: {
+      options: {
+      },
+    },
  },
});
```

## Options

The plugin accepts the following options:

| Option     | Description                                                            | Type                              | Default                                    |
|------------|------------------------------------------------------------------------|-----------------------------------|--------------------------------------------|
| `mutedOnly` | Omit `tests` and always write the muted list, even when empty | `boolean` | `false` |
| `fileName` | Testplan filename                                                      | `string`                          | `testplan.json`                            |
| `filter`   | Function that selects results for `tests`; does not affect `mutedTests` | `(result: TestResult) => boolean` | Failed and broken results |

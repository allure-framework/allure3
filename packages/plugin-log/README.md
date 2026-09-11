# Log Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

This plugin prints report in the terminal.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-log
yarn add @allurereport/plugin-log
pnpm add @allurereport/plugin-log
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    log: {
+      options: {
+      },
+    },
  },
});
```

## Options

The plugin accepts the following options:

| Option               | Description                                      | Type                                     | Default |
|----------------------|--------------------------------------------------|------------------------------------------|---------|
| `allSteps`           | Include all steps in the report                  | `boolean`                                | `false` |
| `withTrace`          | Include step trace in the report                 | `boolean`                                | `false` |
| `groupBy`            | Group tests by given label                       | `suites \| features \| packages \| none` | `none`  |
| `qualityGateResults` | Include quality gate validation results in logs  | `boolean`                                | `true`  |

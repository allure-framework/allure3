# Quality Gate Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

This plugin allows to define additional validation rules to improve your tests.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-quality-gate
yarn add @allurereport/plugin-quality-gate
pnpm add @allurereport/plugin-quality-gate
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    "quality-gate": {
+      options: {
+        fastFail: true,
+        rules: [
+          {
+            minTestsCount: 10,
+          },
+          {
+            id: "first-gate",
+            maxFailures: 1,
+          },
+          {
+            id: "second-gate",
+            successRate: 0.9,
+          },
+        ],
+      },
+    },
  },
});
```

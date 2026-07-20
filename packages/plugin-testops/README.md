# Allure TestOps Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The plugin can create a new launch in Allure TestOps with all the tests data from the current report.

## CI and local runs

The plugin is intended to run in a **CI environment**. When a supported CI is detected, upload to TestOps starts automatically (as long as `accessToken`, `endpoint`, and `projectId` are configured).

On a **local machine** (no CI detected), upload is disabled by default.

To upload from your machine anyway, opt in with one of these environment variables set to a truthy value (`true` or `1`):

| Environment variable       | Purpose |
|----------------------------|---------|
| `ALLURE_TESTOPS_ENABLED`   | Explicitly enable TestOps upload outside CI |
| `CI`                       | Same effect; useful if your tooling already sets `CI` in non-CI workflows |

Example:

```shell
ALLURE_TESTOPS_ENABLED=true allure run ...
```

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-testops
yarn add @allurereport/plugin-testops
pnpm add @allurereport/plugin-testops
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    testops: {
+      options: {
+        launchName: "Hello, TestOps!",
+        launchTags: ["tag1", "tag2"],
+        accessToken: "your_testops_access_token",
+        endpoint: "https://your-testops-instance.com",
+        projectId: "your_testops_project_id",
+      },
+    },
  },
});
```

## Options

The plugin accepts the following options:

| Option             | Description                                                                 | Type      | Default         |
|--------------------|-----------------------------------------------------------------------------|-----------|-----------------|
| `launchName`       | Name of the report which will be assigned to the new launch                 | `string`  | `Allure Report` |
| `launchTags`       | Tags to be assigned to the new launch                                      | `string[]`| `[]`            |
| `accessToken`      | Access token for TestOps API                                               | `string`  | `undefined`     |
| `endpoint`         | TestOps API endpoint                                                       | `string`  | `undefined`     |
| `projectId`        | TestOps project ID                                                         | `string`  | `undefined`     |
| `autocloseLaunch`  | When `true` (default), the launch is closed automatically when the plugin finishes; set to `false` to keep the launch open | `boolean` | `true`          |
| `gitFlow`          | When `true`, collect Git metadata for TestOps Git Flow on CI uploads (opt-in)                                 | `boolean` | `false`         |
| `ancestorLimit`    | How many ancestor commits to attach to the launch for history linking in TestOps | `number`  | `100`           |

### Using options from environment variables

The plugin automatically reads the following environment variables and uses them if not provided in the configuration (the configuration has a higher priority):

| Environment Variable | Configuration option |
|----------------------|----------------------|
| `ALLURE_TOKEN` | `accessToken` |
| `ALLURE_PROJECT_ID` | `projectId` |
| `ALLURE_ENDPOINT` | `endpoint` |
| `ALLURE_LAUNCH_NAME` | `launchName` |
| `ALLURE_LAUNCH_TAGS` | `launchTags` |
| `ALLURE_GIT_FLOW` | `gitFlow` |
| `ALLURE_GIT_ANCESTOR_LIMIT` | `ancestorLimit` |

`ALLURE_TESTOPS_ENABLED` and `CI` are not configuration options: they only control whether upload runs when no CI is detected. See [CI and local runs](#ci-and-local-runs).
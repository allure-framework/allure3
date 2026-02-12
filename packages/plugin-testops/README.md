# Allure TestOps Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The plugin creates a new launch in Allure TestOps with all the tests data from the current report.

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

| Option           | Description                                     | Type    | Default                 |
|------------------|-------------------------------------------------|---------|-------------------------|
| `launchName`     | Name of the report which will be assigned to the new launch                              | `string` | `Allure Report`         |
| `launchTags`     | Tags to be assigned to the new launch                              | `string[]` | `[]`         |
| `accessToken`    | Access token for TestOps API                    | `string` | `undefined`             |
| `endpoint`       | TestOps API endpoint                            | `string` | `undefined` |
| `projectId`      | TestOps project ID                              | `string` | `undefined`             |

### Using options from environment variables

The plugin automatically reads the following environment variables and uses them if not provided in the configuration (the configuration has a higher priority):

| Environment Variable | Configuration option |
|----------------------|----------------------|
| `ALLURE_TOKEN` | `accessToken` |
| `ALLURE_PROJECT_ID` | `projectId` |
| `ALLURE_ENDPOINT` | `endpoint` |
| `ALLURE_LAUNCH_NAME` | `launchName` |
| `ALLURE_LAUNCH_TAGS` | `launchTags` |

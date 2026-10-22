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

The plugin is intended to run in a **CI environment**. When a supported CI is detected, upload to Allure TestOps starts automatically (as long as `accessToken`, `endpoint`, and `projectId` are configured).

On a **local machine** (no CI detected), upload is disabled by default.

To upload from your machine anyway, opt in with one of these environment variables set to a truthy value (`true` or `1`):

| Environment variable       | Purpose |
|----------------------------|---------|
| `ALLURE_TESTOPS_ENABLED`   | Explicitly enable Allure TestOps upload outside CI |
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
+        launchName: "Hello, Allure TestOps!",
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
| `accessToken`      | Access token for Allure TestOps API                                        | `string`  | `undefined`     |
| `endpoint`         | Allure TestOps API endpoint                                                | `string`  | `undefined`     |
| `projectId`        | Allure TestOps project ID                                                  | `string`  | `undefined`     |
| `autocloseLaunch`  | When `true` (default), the launch is closed automatically when the plugin finishes, unless some uploads failed; set to `false` to keep the launch open | `boolean` | `true`          |
| `gitFlow`          | When `true`, collect Git metadata for Allure TestOps Git Flow on CI uploads (opt-in) | `boolean` | `false`         |
| `ancestorLimit`    | How many ancestor commits to attach to the launch for history linking in Allure TestOps | `number`  | `100`           |
| `uploadRateLimit`  | Caps how fast uploads are sent to Allure TestOps within a rolling time window (requests/files/bytes per window); pass `false` to disable pacing entirely | `{ windowMs: number; maxRequestsPerWindow?: number; maxFilesPerWindow?: number; maxBytesPerWindow?: number } \| false` | `20` req/s, `1000` files/s, `1 GiB`/s |
| `reopenClosedLaunch` | When `true`, a launch that Allure TestOps reports as closed is reopened automatically instead of failing the upload | `boolean` | `false`         |

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

## Environment variables

Every upload session sends environment variables to Allure TestOps, which maps them to the project's env vars. A variable shows up on test results only if its key matches a key of the project's env var schema in Allure TestOps exactly, including case: a schema key `browser` does not match a variable named `Browser`. Other keys are ignored.

The plugin sends, from weakest to strongest:

1. the environment variables of the process (for example, the ones set by your CI);
2. the report-level `variables` from the Allure configuration;
3. the `variables` of the environment (from `environments`) the test result belongs to.

A stronger source overrides a weaker one when the keys are the same. Keys that differ only in case are different variables and are all sent. Configuration variables without a value (for example, `process.env.STAND` when `STAND` is unset, or an empty string) and values that aren't strings, numbers or booleans are not sent, so they don't override anything: an environment variable without a value keeps the report-level value.

```js
import { defineConfig } from "allure";

export default defineConfig({
  variables: {
    Stand: process.env.STAND ?? "staging",
  },
  environments: {
    chrome: {
      matcher: ({ labels }) => labels.some(({ name, value }) => name === "browser" && value === "chrome"),
      variables: { browser: "chrome" },
    },
    firefox: {
      matcher: ({ labels }) => labels.some(({ name, value }) => name === "browser" && value === "firefox"),
      variables: { browser: "firefox" },
    },
  },
  plugins: {
    testops: {
      options: {},
    },
  },
});
```

Test results of an environment that defines its own `variables` are uploaded in a separate upload session carrying those variables; the plugin creates it once per environment and reuses it for the whole run. Other test results go into the upload session the plugin creates for each upload, together with global attachments and errors.

Report-level `variables` are the same for every test result. When a report is generated from several dumps (`allure generate --dump …`), they are merged and the last dump wins. Environment `variables` come from the configuration used to generate the report, so values that differ between dumps, such as the browser of a matrix job, belong in the `variables` of environments defined in that configuration rather than in report-level `variables`.

Env vars are part of a test result's identity in Allure TestOps. If your project's env var schema contains keys that you now set in `variables`, the history of the affected tests starts anew once after upgrading the plugin.

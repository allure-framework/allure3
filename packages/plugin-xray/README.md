# Xray Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at [allurereport.org](https://allurereport.org)
- 📚 [Documentation](https://allurereport.org/docs/) – Discover the official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – Get help from the team and community
- 📢 [Official Announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – Stay up to date with the latest updates
- 💬 [General Discussion](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – Engage in casual conversations, share insights, and ideas with the community

---

## Overview

This plugin exports test statuses from the Allure report to [Xray](https://www.getxray.app/) (Jira Server / Data Center):
it finds the test runs of the given Test Executions and sets their status to `PASS`, `FAIL` or `TODO`.
It does not create Tests or Test Executions, and does not import results through the Xray import API.

> Xray Cloud is not supported yet: it uses a different API and authentication.

## Installation

Use your preferred package manager to install the package:

```shell
npm add @allurereport/plugin-xray
yarn add @allurereport/plugin-xray
pnpm add @allurereport/plugin-xray
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    xray: {
+      options: {
+        endpoint: "https://jira.example.com",
+        username: "allure",
+        password: "...",
+        executions: ["XT-6"],
+      },
+    },
  },
});
```

## How it works

1. Add a `tms` link with the Jira key of the Xray Test to your test cases (for example in Java: `@TmsLink("XT-1")`).
   The key is taken from the link name when it looks like a Jira key, otherwise from the first key found in the link URL.
2. Results of all tests with the same key are merged: `FAIL` beats `PASS`, `PASS` beats `TODO`.
3. For every test run with that key in the listed Test Executions the status is updated (when it differs).
4. Unless disabled, a comment with the link to the report is added to each Test Execution. It is added only when the report url is known.

Failed requests to Jira are logged to stderr and do not fail the report generation.

## Options

| Option       | Description                                                          | Type       | Environment Variable                         |
| ------------ | -------------------------------------------------------------------- | ---------- | -------------------------------------------- |
| `endpoint`   | Jira base url                                                        | `string`   | `ALLURE_XRAY_ENDPOINT`                       |
| `username`   | Jira username (basic auth)                                           | `string`   | `ALLURE_XRAY_USERNAME`                       |
| `password`   | Jira password (basic auth)                                           | `string`   | `ALLURE_XRAY_PASSWORD`                       |
| `token`      | Personal access token, used instead of username and password         | `string`   | `ALLURE_XRAY_TOKEN`                          |
| `executions` | Keys of Test Executions to update (env: comma-separated list)        | `string[]` | `ALLURE_XRAY_EXECUTIONS`                     |
| `statuses`   | Xray status (`PASS`, `FAIL`, `TODO`) for an Allure test status       | `object`   | `ALLURE_XRAY_STATUS_<PASSED\|FAILED\|BROKEN\|SKIPPED\|UNKNOWN>` |
| `comment`    | Comment on Test Executions with a link to the report (default: true) | `boolean`  | `ALLURE_XRAY_COMMENT`                        |

Default status mapping: `passed → PASS`, `failed → FAIL`, `broken → FAIL`, `skipped → TODO`, `unknown → TODO`.

**Note:** Any values set in your `allurerc.mjs` configuration file will take precedence over values defined in environment variables.

## Requirements

- Jira Server / Data Center with the Xray app installed. The plugin uses the Xray REST API (`rest/raven/1.0`) and the Jira REST API v2.
- The Test Executions already exist and contain the Tests you want to update. The plugin doesn't create Tests, Test Executions or test runs.
- The Jira user (or the owner of the token) can browse the Test Executions, edit their test runs, and add comments.

## Usage

### Link tests to Xray Tests

Add a `tms` link whose name is the Jira key of the Xray Test. For example, in Java:

```java
@TmsLink("XT-1")
@Test
void shouldLogin() { /* ... */ }
```

Several test results may share one key (parameterized tests, retries across environments, and so on). They are merged into a single status:

| Results for the key      | Status in Xray |
| ------------------------ | -------------- |
| any failed or broken     | `FAIL`         |
| passed, no failures      | `PASS`         |
| only skipped or unknown  | `TODO`         |

Test runs whose key isn't linked from any test in the report are left untouched. The same goes for runs that already have the target status.

### Run in CI

Credentials and the list of Test Executions are usually passed through environment variables, so the config file stays free of secrets:

```shell
export ALLURE_XRAY_ENDPOINT=https://jira.example.com
export ALLURE_XRAY_TOKEN=<personal access token>
export ALLURE_XRAY_EXECUTIONS=XT-6,XT-7

npx allure generate ./allure-results
```

with the plugin enabled in `allurerc.mjs`:

```js
import { defineConfig } from "allure";

export default defineConfig({
  plugins: {
    xray: {},
  },
});
```

### Custom status mapping

Allure has five test statuses and Xray test runs get one of `PASS`, `FAIL` and `TODO`. To change the defaults, set `statuses`:

```js
xray: {
  options: {
    statuses: { skipped: "FAIL", unknown: "TODO" },
  },
},
```

or the matching environment variable, for example `ALLURE_XRAY_STATUS_SKIPPED=FAIL`. Any other Xray status (such as `EXECUTING`) is rejected with an error.

### Comment with the report link

After the update, the plugin adds a comment with the report link to every listed Test Execution. The comment is posted on every report generation and isn't deduplicated. It requires the report URL (for example when the report is published) and at least one test linked to Xray, so it is skipped otherwise. Set `comment: false` or `ALLURE_XRAY_COMMENT=false` to turn it off.

## Troubleshooting

- **Nothing is updated.** Check that the link type is `tms`, that its name (or, when empty, its URL) contains the Test key, and that the key belongs to a test run in one of the listed Test Executions.
- **Errors in the log.** A failed request to Jira is printed as `[Allure Xray Plugin] failed to ...` with the HTTP status and doesn't fail the report generation. A 401 or 403 usually means missing credentials or permissions.
- **Plugin fails to start.** It throws an error when the endpoint, the credentials (a token, or both username and password), or the Test Executions aren't set, or when a status isn't one of `PASS`, `FAIL`, `TODO`.

## Limitations

- Xray Cloud isn't supported, as it has a different API and authentication.
- Results are not imported through the Xray import API, and Tests and Test Executions are not created.

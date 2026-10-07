# Metrics Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

This plugin exports the metrics of a test run to [Prometheus](https://prometheus.io) and [InfluxDB](https://www.influxdata.com). It is the Allure 3 counterpart of the `PrometheusExportPlugin` and `InfluxDbExportPlugin` from Allure 2 and keeps their metric names and file formats, so existing dashboards and scrapers continue to work.

Each export writes a file to the report directory and, optionally, pushes the same data to Prometheus Pushgateway or to the InfluxDB write API.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-metrics
yarn add @allurereport/plugin-metrics
pnpm add @allurereport/plugin-metrics
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  plugins: {
+    metrics: {
+      options: {
+        prometheus: { labels: { team: "qa", branch: "main" } },
+        influxdb: true,
+      },
+    },
  },
});
```

If neither `prometheus` nor `influxdb` is set, both exports are enabled with the defaults, as it was in Allure 2.

## Options

| Option               | Description                                                                                                  | Type                         | Default |
|----------------------|--------------------------------------------------------------------------------------------------------------|------------------------------|---------|
| `prometheus`         | Prometheus export. `true` enables it with the defaults                                                       | `boolean \| PrometheusOptions` | both enabled when nothing is set |
| `influxdb`           | InfluxDB export. `true` enables it with the defaults                                                         | `boolean \| InfluxDbOptions`   | both enabled when nothing is set |
| `performanceMetrics` | Also export the averaged per-run performance metrics (`launch_metric_<key>`). Not part of Allure 2            | `boolean`                    | `false` |
| `failOnPushError`    | Fail the report generation when a push fails. Otherwise only a warning is printed                            | `boolean`                    | `false` |

### `prometheus`

| Option        | Description                                                                                                                                                           | Type                                 | Default                      |
|---------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------|------------------------------|
| `fileName`    | Report-relative path of the file. Absolute paths are written to that location instead                                                                                  | `string`                             | `export/prometheusData.txt`  |
| `labels`      | Labels added to every line. A string is used as is (`team="qa",env="ci"`), an object is rendered and escaped. Falls back to `ALLURE_PROMETHEUS_LABELS` (or `allure.prometheus.labels`) environment variable | `string \| Record<string, string>` | none                         |
| `pushgateway` | Pushes the metrics to Pushgateway with `PUT /metrics/job/<job>/<key>/<value>`                                                                                           | `PushgatewayOptions`                 | no push                      |

`pushgateway` options: `url` (required), `job` (default `allure`), `grouping` (extra grouping keys), and `authorization` / `authorizationEnv` (the `Authorization` header value or the name of the environment variable that holds it).

### `influxdb`

| Option     | Description                                                                           | Type              | Default                    |
|------------|---------------------------------------------------------------------------------------|-------------------|----------------------------|
| `fileName` | Report-relative path of the file. Absolute paths are written to that location instead | `string`          | `export/influxDbData.txt`  |
| `push`     | Pushes the metrics to the write API                                                   | `InfluxDbPushOptions` | no push                |

`push` options: `url` (required), `bucket` and optionally `org` for InfluxDB 2.x (`/api/v2/write`) or `db` for InfluxDB 1.x (`/write`), and `token` / `tokenEnv` (the API token or the name of the environment variable that holds it). Prefer `tokenEnv` and `authorizationEnv` over literal secrets in the config file.

```js
export default defineConfig({
  plugins: {
    metrics: {
      options: {
        prometheus: {
          labels: { team: "qa" },
          pushgateway: { url: "http://pushgateway:9091", job: "allure", grouping: { instance: "ci" } },
        },
        influxdb: {
          push: { url: "http://influxdb:8086", org: "qa", bucket: "allure", tokenEnv: "INFLUXDB_TOKEN" },
        },
      },
    },
  },
});
```

## Exported metrics

Retries are not counted in any metric except `launch_retries`.

| Metric                            | Description                                                                                      |
|-----------------------------------|--------------------------------------------------------------------------------------------------|
| `launch_status_<status>`          | Number of tests per status: `failed`, `broken`, `passed`, `skipped`, `unknown`                   |
| `launch_time_duration`            | Wall-clock duration of the run: the last stop minus the first start, in milliseconds              |
| `launch_time_min_duration`        | The shortest test duration                                                                       |
| `launch_time_max_duration`        | The longest test duration                                                                        |
| `launch_time_sum_duration`        | The sum of all test durations                                                                    |
| `launch_time_start`, `launch_time_stop` | Start and stop of the run as a timestamp in milliseconds                                    |
| `launch_problems_<category>`      | Number of tests in each category from the `categories` option  |
| `launch_retries_retries`          | Number of retried attempts                                                                       |
| `launch_retries_run`              | Number of tests that were run                                                                    |
| `launch_metric_<key>`             | Averaged performance metric (`performanceMetrics` only)                                          |

Keys are lower-cased and whitespaces are replaced with underscores. Characters Prometheus does not accept in metric names are additionally replaced with `_` in the Prometheus file.

> Unlike in Allure 2, a test belongs to a single category: the first one whose matchers it satisfies.

### File formats

Prometheus (`export/prometheusData.txt`):

```text
launch_status_passed{team="qa"} 120
launch_status_failed{team="qa"} 3
launch_time_duration{team="qa"} 45210
launch_problems_product_errors{team="qa"} 3
launch_retries_retries{team="qa"} 2
launch_retries_run{team="qa"} 123
```

InfluxDB line protocol (`export/influxDbData.txt`), the timestamp is the report generation time in nanoseconds:

```text
launch_status passed=120 1791378000000000000
launch_status failed=3 1791378000000000000
launch_time duration=45210 1791378000000000000
```

## Programmatic usage

`collectMetrics` is a pure function that turns a statistic and test results into a list of `{ name, key, value }` lines. It is exported so other consumers, for example charts, can build on the same model.

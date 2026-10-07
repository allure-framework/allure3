import type { MetricSample } from "@allurereport/core-api";

/**
 * Single exported metric, the same shape as `MetricLine` in Allure 2: `name` is the measurement
 * (`launch_status`, `launch_time`, `launch_problems`, `launch_retries`), `key` is the series inside of it.
 */
export type MetricLine = {
  name: string;
  key: string;
  value: number;
};

export type PrometheusPushgatewayOptions = {
  /** Pushgateway base url, e.g. `http://localhost:9091` */
  url: string;
  /** Value of the `job` grouping key. Default: `allure` */
  job?: string;
  /** Additional grouping keys appended to the push path: `/metrics/job/<job>/<key>/<value>` */
  grouping?: Record<string, string>;
  /** Raw `Authorization` header value. Prefer `authorizationEnv` to keep secrets out of the config */
  authorization?: string;
  /** Name of an environment variable holding the `Authorization` header value */
  authorizationEnv?: string;
};

export type PrometheusOptions = {
  /** Report-relative path (or an absolute one) of the exported file. Default: `export/prometheusData.txt` */
  fileName?: string;
  /**
   * Labels attached to every line. A string is used as is (`a="b",c="d"`), same as `allure.prometheus.labels`
   * in Allure 2. Falls back to the `ALLURE_PROMETHEUS_LABELS` / `allure.prometheus.labels` environment variable.
   */
  labels?: string | Record<string, string>;
  /** Pushes the metrics to Prometheus Pushgateway after the report is done */
  pushgateway?: PrometheusPushgatewayOptions;
};

export type InfluxDbPushOptions = {
  /** InfluxDB base url, e.g. `http://localhost:8086` */
  url: string;
  /** InfluxDB 2.x organization */
  org?: string;
  /** InfluxDB 2.x bucket */
  bucket?: string;
  /** InfluxDB 1.x database. Used when `bucket` is not set */
  db?: string;
  /** Name of an environment variable holding the API token (InfluxDB 2.x) */
  tokenEnv?: string;
  /** API token. Prefer `tokenEnv` to keep secrets out of the config */
  token?: string;
};

export type InfluxDbOptions = {
  /** Report-relative path (or an absolute one) of the exported file. Default: `export/influxDbData.txt` */
  fileName?: string;
  /** Pushes the metrics to the InfluxDB write API after the report is done */
  push?: InfluxDbPushOptions;
};

export type MetricsPluginOptions = {
  /** Prometheus export. Enabled when set to `true` or an object */
  prometheus?: boolean | PrometheusOptions;
  /** InfluxDB export. Enabled when set to `true` or an object */
  influxdb?: boolean | InfluxDbOptions;
  /**
   * Also exports the averaged per-run performance metrics (`store.allMetrics()`) as `launch_metric_<key>`.
   * Not part of Allure 2, so disabled by default.
   */
  performanceMetrics?: boolean;
  /** Fail the report generation when pushing fails. By default only a warning is printed */
  failOnPushError?: boolean;
};

export type MetricsInput = {
  /** Statistic of the current run, retries are not included */
  statistic: Partial<Record<"failed" | "broken" | "passed" | "skipped" | "unknown", number>>;
  /** Test results of the current run without retries */
  testResults: ReadonlyArray<{
    start?: number;
    stop?: number;
    duration?: number;
    categories?: ReadonlyArray<{ name: string }>;
  }>;
  retries: number;
  performanceMetrics?: MetricSample[];
};

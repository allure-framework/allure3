export { collectMetrics } from "./collect.js";
export type {
  InfluxDbOptions,
  InfluxDbPushOptions,
  MetricLine,
  MetricsInput,
  MetricsPluginOptions,
  PrometheusOptions,
  PrometheusPushgatewayOptions,
} from "./model.js";
export { MetricsPlugin as default } from "./plugin.js";

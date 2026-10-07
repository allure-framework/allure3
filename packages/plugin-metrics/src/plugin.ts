import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

import { extractErrorMatchingData, matchCategory } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";

import { collectMetrics } from "./collect.js";
import { renderInfluxDb } from "./influxdb.js";
import type { InfluxDbOptions, MetricsPluginOptions, PrometheusOptions } from "./model.js";
import { labelsFromEnv, renderPrometheus } from "./prometheus.js";
import { pushToInfluxDb, pushToPushgateway } from "./push.js";

export const DEFAULT_PROMETHEUS_FILE = "export/prometheusData.txt";
export const DEFAULT_INFLUXDB_FILE = "export/influxDbData.txt";

const section = <T extends object>(value: boolean | T | undefined): T | undefined => {
  if (value === true) {
    return {} as T;
  }

  return value || undefined;
};

export class MetricsPlugin implements Plugin {
  constructor(readonly options: MetricsPluginOptions = {}) {}

  done = async (context: PluginContext, store: AllureStore): Promise<void> => {
    const {
      prometheus: prometheusOption,
      influxdb: influxdbOption,
      performanceMetrics,
      failOnPushError,
    } = this.options;
    // when nothing is configured explicitly, both exports are enabled the same way they were in Allure 2
    const noneConfigured = prometheusOption === undefined && influxdbOption === undefined;
    const prometheus = section<PrometheusOptions>(noneConfigured ? true : prometheusOption);
    const influxdb = section<InfluxDbOptions>(noneConfigured ? true : influxdbOption);

    if (!prometheus && !influxdb) {
      return;
    }

    const [statistic, testResults, allResults, performance] = await Promise.all([
      store.testsStatistic(),
      store.allTestResults(),
      store.allTestResults({ includeRetries: true }),
      performanceMetrics ? store.allMetrics() : Promise.resolve(undefined),
    ]);
    const categories = context.categories ?? [];
    const lines = collectMetrics({
      statistic,
      testResults: testResults.map((tr) => ({
        start: tr.start,
        stop: tr.stop,
        duration: tr.duration,
        categories: categories.length
          ? [matchCategory(categories, extractErrorMatchingData(tr))].filter((category) => category !== undefined)
          : [],
      })),
      retries: allResults.length - testResults.length,
      performanceMetrics: performance,
    });
    const pushErrors: Error[] = [];
    const push = async (task: () => Promise<void>) => {
      try {
        await task();
      } catch (err) {
        pushErrors.push(err as Error);
      }
    };

    if (prometheus) {
      const body = renderPrometheus(lines, prometheus.labels ?? labelsFromEnv());

      await this.#write(context, prometheus.fileName ?? DEFAULT_PROMETHEUS_FILE, body);

      if (prometheus.pushgateway) {
        await push(() => pushToPushgateway(prometheus.pushgateway!, body));
      }
    }

    if (influxdb) {
      const body = renderInfluxDb(lines);

      await this.#write(context, influxdb.fileName ?? DEFAULT_INFLUXDB_FILE, body);

      if (influxdb.push) {
        await push(() => pushToInfluxDb(influxdb.push!, body));
      }
    }

    for (const err of pushErrors) {
      if (failOnPushError) {
        throw err;
      }

      // eslint-disable-next-line no-console
      console.warn(`[plugin-metrics] ${err.message}`);
    }
  };

  async #write(context: PluginContext, fileName: string, content: string): Promise<void> {
    const data = Buffer.from(content, "utf-8");

    // relative paths end up in the report directory, absolute ones are written as is
    if (!isAbsolute(fileName)) {
      await context.reportFiles.addFile(fileName, data);
      return;
    }

    await mkdir(dirname(fileName), { recursive: true });
    await writeFile(fileName, data);
  }
}

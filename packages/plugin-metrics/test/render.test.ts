import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { renderInfluxDb } from "../src/influxdb.js";
import type { MetricLine } from "../src/model.js";
import { labelsFromEnv, renderLabels, renderPrometheus } from "../src/prometheus.js";

beforeEach(async () => {
  await story("render");
});

const lines: MetricLine[] = [
  { name: "launch_status", key: "passed", value: 3 },
  { name: "launch_time", key: "min_duration", value: 50 },
  { name: "launch_problems", key: "Product errors", value: 2 },
];

describe("renderPrometheus", () => {
  it("renders lines in the Allure 2 layout", () => {
    expect(renderPrometheus(lines)).toBe(
      "launch_status_passed 3\nlaunch_time_min_duration 50\nlaunch_problems_product_errors 2\n",
    );
  });

  it("uses a string labels value as is", () => {
    expect(renderPrometheus(lines.slice(0, 1), 'team="qa",env="ci"')).toBe(
      'launch_status_passed{team="qa",env="ci"} 3\n',
    );
  });

  it("renders and escapes labels given as an object", () => {
    expect(renderLabels({ team: "qa", note: 'say "hi"\\\n' })).toBe('{team="qa",note="say \\"hi\\"\\\\\\n"}');
  });

  it("omits empty labels", () => {
    expect(renderLabels("")).toBe("");
    expect(renderLabels({})).toBe("");
    expect(renderLabels(undefined)).toBe("");
  });

  it("sanitizes characters Prometheus does not accept in metric names", () => {
    expect(renderPrometheus([{ name: "launch_problems", key: "Timeouts (slow) / 5xx", value: 1 }])).toBe(
      "launch_problems_timeouts__slow____5xx 1\n",
    );
  });
});

describe("labelsFromEnv", () => {
  it("reads both spellings of the Allure 2 variable", () => {
    expect(labelsFromEnv({ ALLURE_PROMETHEUS_LABELS: 'a="b"' })).toBe('a="b"');
    expect(labelsFromEnv({ "allure.prometheus.labels": 'c="d"' })).toBe('c="d"');
    expect(labelsFromEnv({})).toBeUndefined();
  });
});

describe("renderInfluxDb", () => {
  it("renders lines in the Allure 2 layout with a nanosecond timestamp", () => {
    const now = new Date("2026-10-07T12:00:00.789Z");
    const timestamp = `${Math.floor(now.getTime() / 1000)}000000000`;

    expect(renderInfluxDb(lines, now)).toBe(
      [
        `launch_status passed=3 ${timestamp}`,
        `launch_time min_duration=50 ${timestamp}`,
        `launch_problems product_errors=2 ${timestamp}`,
      ].join("\n") + "\n",
    );
  });

  it("escapes characters that are special in line protocol", () => {
    const [line] = renderInfluxDb([{ name: "launch_problems", key: "a,b=c", value: 1 }], new Date(0)).split("\n");

    expect(line).toBe("launch_problems a\\,b\\=c=1 0");
  });
});

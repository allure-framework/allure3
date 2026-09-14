import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { attachment, step } from "allure-js-commons";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../src/locales");

describe("awesome locales", () => {
  it("defines metrics labels for every locale", () => {
    const localeFiles = readdirSync(localesDir).filter((file) => file.endsWith(".json"));

    expect(localeFiles.length).toBeGreaterThan(0);

    return step("verify metrics labels in every awesome locale", async () => {
      await attachment("checked locales", localeFiles.join("\n"), "text/plain");

      localeFiles.forEach((file) => {
        const locale = JSON.parse(readFileSync(join(localesDir, file), "utf8"));

        expect(locale.sections.metrics, file).toEqual(expect.any(String));
        expect(locale.empty["no-metrics-results"], file).toEqual(expect.any(String));
        expect(locale.charts.metrics, file).toEqual(
          expect.objectContaining({
            title: expect.any(String),
            summary: expect.any(String),
            phaseSummary: expect.any(String),
            currentValues: expect.any(String),
            historyTitle: expect.any(String),
            noHistory: expect.any(String),
            date: expect.any(String),
            groups: {
              other: expect.any(String),
            },
            table: {
              metric: expect.any(String),
              phase: expect.any(String),
              count: expect.any(String),
              total: expect.any(String),
              avg: expect.any(String),
              min: expect.any(String),
              max: expect.any(String),
              value: expect.any(String),
              delta: expect.any(String),
              trend: expect.any(String),
              source: expect.any(String),
              report: expect.any(String),
              date: expect.any(String),
            },
          }),
        );
      });
    });
  });
});

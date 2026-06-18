import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { attachment, step } from "allure-js-commons";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../src/locales");

describe("dashboard locales", () => {
  it("defines metrics labels for every locale", () => {
    const localeFiles = readdirSync(localesDir).filter((file) => file.endsWith(".json"));

    expect(localeFiles.length).toBeGreaterThan(0);

    return step("verify metrics labels in every dashboard locale", async () => {
      await attachment("checked locales", localeFiles.join("\n"), "text/plain");

      localeFiles.forEach((file) => {
        const locale = JSON.parse(readFileSync(join(localesDir, file), "utf8"));

        expect(locale.charts.metrics, file).toEqual({
          title: expect.any(String),
          table: {
            metric: expect.any(String),
            value: expect.any(String),
            delta: expect.any(String),
            source: expect.any(String),
          },
        });
      });
    });
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { attachment, epic, feature, label, story, step } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("locales");
  await label("coverage", "ui-components");
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../src/locales");

describe("dashboard locales", () => {
  it("defines the label of the back to overview link for every locale", () => {
    const localeFiles = readdirSync(localesDir).filter((file) => file.endsWith(".json"));

    expect(localeFiles.length).toBeGreaterThan(0);

    return step("verify the link label in every dashboard locale", async () => {
      localeFiles.forEach((file) => {
        const locale = JSON.parse(readFileSync(join(localesDir, file), "utf8"));

        expect(locale.controls.backToOverview, file).toEqual(expect.any(String));
      });
    });
  });

  it("defines lazy loading errors and retry actions for every locale", () => {
    const localeFiles = readdirSync(localesDir).filter((file) => file.endsWith(".json"));

    expect(localeFiles.length).toBeGreaterThan(0);

    return step("verify localized lazy loading recovery labels", async () => {
      await attachment("checked locales", localeFiles.join("\n"), "text/plain");
      for (const file of localeFiles) {
        const locale = JSON.parse(readFileSync(join(localesDir, file), "utf8"));
        for (const key of ["charts.retry", "charts.loadError"]) {
          const [namespace, name] = key.split(".");
          const value = locale[namespace]?.[name];
          expect(value, `${file}: ${key}`).toEqual(expect.any(String));
          expect(value.trim().length, `${file}: ${key}`).toBeGreaterThan(0);
        }
      }
    });
  });
});

it("defines the generated footer label and date separator in every dashboard locale", () => {
  const localeFiles = readdirSync(localesDir).filter((file) => file.endsWith(".json"));
  for (const file of localeFiles) {
    const locale = JSON.parse(readFileSync(join(localesDir, file), "utf8"));
    expect(locale.ui.at, file).toEqual(expect.any(String));
    expect(locale.ui.generatedAt, file).toContain("{{timestamp, timestamp_long}}");
  }
});

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { epic, feature, label, story, step } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("locales");
  await label("coverage", "ui-components");
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../src/translations");

describe("classic locales", () => {
  it("defines overview navigation and chart recovery labels for every locale", () => {
    const localeFiles = readdirSync(localesDir).filter((file) => file.endsWith(".json"));

    expect(localeFiles.length).toBeGreaterThan(0);

    return step("verify the link label in every classic locale", async () => {
      localeFiles.forEach((file) => {
        const locale = JSON.parse(readFileSync(join(localesDir, file), "utf8"));

        expect(locale.controls.backToOverview, file).toEqual(expect.any(String));
        expect(locale.charts.retry, file).toEqual(expect.stringMatching(/\S/));
        expect(locale.charts.loadError, file).toEqual(expect.stringMatching(/\S/));
      });
    });
  });

  it("defines every overview label of the English locale in the Russian locale", () => {
    const readLocale = (file: string) => JSON.parse(readFileSync(join(localesDir, file), "utf8"));
    const en = readLocale("en.json");
    const ru = readLocale("ru.json");
    const baseKey = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "");
    const enKeys = [...new Set(Object.keys(en.overview).map(baseKey))];
    const ruKeys = new Set(Object.keys(ru.overview).map(baseKey));

    expect(enKeys.length).toBeGreaterThan(0);
    enKeys.forEach((key) => expect(ruKeys.has(key), key).toBe(true));
  });
});

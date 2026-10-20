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
});

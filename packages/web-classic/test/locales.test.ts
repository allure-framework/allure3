import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { epic, feature, label, story, step } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { AVAILABLE_LOCALES } from "../src/translations/constants.js";

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

describe("classic locale completeness", () => {
  const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
  const baseKeys = (node: Record<string, unknown>, prefix = ""): string[] =>
    Object.entries(node).flatMap(([key, value]) =>
      value && typeof value === "object"
        ? baseKeys(value as Record<string, unknown>, `${prefix}${key}.`)
        : [`${prefix}${key}`.replace(PLURAL_SUFFIX, "")],
    );
  const readLocale = (locale: string) => JSON.parse(readFileSync(join(localesDir, `${locale}.json`), "utf8"));

  it.each(AVAILABLE_LOCALES.filter((locale) => locale !== "en" && locale !== "en-iso"))(
    "defines every english key in the %s locale",
    (locale) => {
      const expected = new Set(baseKeys(readLocale("en")));
      const actual = new Set(baseKeys(readLocale(locale)));
      const missing = [...expected].filter((key) => !actual.has(key));

      expect(expected.size).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    },
  );
});

describe("classic test result page locales", () => {
  it("defines test result page labels in every locale that translates the ui section", () => {
    // partial locales without a ui section fall back to english for the whole section
    const localeFiles = readdirSync(localesDir)
      .filter((file) => file.endsWith(".json"))
      .filter((file) => JSON.parse(readFileSync(join(localesDir, file), "utf8")).ui);

    expect(localeFiles).toEqual(expect.arrayContaining(["en.json", "ru.json", "de.json"]));

    return step("verify test result page labels", async () => {
      localeFiles.forEach((file) => {
        const locale = JSON.parse(readFileSync(join(localesDir, file), "utf8"));

        for (const key of [
          "precondition",
          "expectedResult",
          "categories",
          "tags",
          "owner",
          "fullname",
          "test-case-id",
          "history-id",
        ]) {
          expect(locale.ui[key], `${file} ui.${key}`).toEqual(expect.stringMatching(/\S/));
        }

        expect(locale.ui.successRate, file).toContain("{{rate}}");
        expect(locale.ui.successRate, file).toContain("{{passed}}");
        expect(locale.ui.successRate, file).toContain("{{total}}");
      });
    });
  });
});

describe("classic attachment locales", () => {
  it("defines attachment viewer and error diff labels for every selectable locale", () => {
    const keys = [
      "controls.showDiff",
      "controls.comparison",
      "controls.expected",
      "controls.actual",
      "controls.viewMode",
      "controls.unified",
      "controls.side-by-side",
      "controls.compareBy",
      "controls.chars",
      "controls.words",
      "controls.lines",
      "controls.loadComparisonError",
      "controls.retry",
      "controls.loadAttachmentViewerError",
      "controls.previewAttachment",
      "controls.viewCode",
      "empty.no-test-steps-results",
      "empty.no-message-provided",
      "errors.missedAttachment",
      "attachments.imageDiff.mode.diff",
      "attachments.imageDiff.mode.overlay",
      "attachments.imageDiff.empty.failed-to-load",
      "attachments.imageDiff.image.expected",
    ];
    const localeFiles = AVAILABLE_LOCALES.map((locale) => `${locale}.json`).filter((file) =>
      readdirSync(localesDir).includes(file),
    );

    expect(localeFiles.length).toBeGreaterThan(1);

    localeFiles.forEach((file) => {
      const locale = JSON.parse(readFileSync(join(localesDir, file), "utf8"));

      keys.forEach((key) => {
        const value = key.split(".").reduce((node, part) => node?.[part], locale);

        expect(value, `${file}: ${key}`).toEqual(expect.stringMatching(/\S/));
      });
    });
  });
});

describe("classic tree locales", () => {
  it("translates the tree controls in every locale that translates the tree filters", () => {
    const localeFiles = readdirSync(localesDir).filter((file) => file.endsWith(".json"));

    return step("verify the tree namespace next to the filters namespace", async () => {
      localeFiles.forEach((file) => {
        const locale = JSON.parse(readFileSync(join(localesDir, file), "utf8"));

        if (!locale.filters) {
          return;
        }

        ["collapse-all", "expand-all", "show-groups-info", "hide-groups-info", "download-csv", "flaky"].forEach(
          (key) => {
            expect(locale.tree?.[key], `${file} tree.${key}`).toEqual(expect.stringMatching(/\S/));
          },
        );
        // a plain "retries" key is the fallback for plural forms a locale doesn't define
        expect(locale.tree.retries ?? locale.tree.retries_other, `${file} tree.retries`).toContain("{{count}}");
      });
    });
  });
});

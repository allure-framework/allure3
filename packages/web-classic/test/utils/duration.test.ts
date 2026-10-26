import { formatDuration } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { formatClassicDuration } from "../../src/utils/duration.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("classic duration");
  await label("coverage", "ui-components");
});

describe("formatClassicDuration", () => {
  it("shows nothing for an unknown duration like Allure 2", () => {
    expect(formatClassicDuration(undefined)).toBeUndefined();
    expect(formatClassicDuration(null as unknown as number)).toBeUndefined();
  });

  it("formats a known duration", () => {
    expect(formatClassicDuration(1500)).toBe(formatDuration(1500));
    expect(formatClassicDuration(0)).toBe(formatDuration(0));
  });
});

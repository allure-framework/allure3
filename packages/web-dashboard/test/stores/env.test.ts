// @vitest-environment jsdom
import { getReportStorageKey } from "@allurereport/web-commons";
import { expect, it, vi } from "vite-plus/test";

it("preserves Awesome's collapsed environments while restoring Dashboard selection", async () => {
  vi.resetModules();
  localStorage.setItem(getReportStorageKey("collapsedEnvironments"), '["keep-me"]');
  localStorage.setItem(getReportStorageKey("currentEnvironment"), '"selected"');
  const { currentEnvironment } = await import("../../src/stores/env");
  expect(currentEnvironment.value).toBe("selected");
  currentEnvironment.value = "next";
  expect(localStorage.getItem(getReportStorageKey("currentEnvironment"))).toBe('"next"');
  expect(localStorage.getItem(getReportStorageKey("collapsedEnvironments"))).toBe('["keep-me"]');
  localStorage.clear();
});

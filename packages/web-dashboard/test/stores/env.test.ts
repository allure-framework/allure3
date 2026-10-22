// @vitest-environment jsdom
import { expect, it, vi } from "vite-plus/test";

it("preserves Awesome's collapsed environments while restoring Dashboard selection", async () => {
  vi.resetModules();
  localStorage.setItem("collapsedEnvironments", '["keep-me"]');
  localStorage.setItem("currentEnvironment", '"selected"');
  const { currentEnvironment } = await import("../../src/stores/env");
  expect(currentEnvironment.value).toBe("selected");
  currentEnvironment.value = "next";
  expect(localStorage.getItem("currentEnvironment")).toBe('"next"');
  expect(localStorage.getItem("collapsedEnvironments")).toBe('["keep-me"]');
  localStorage.clear();
});

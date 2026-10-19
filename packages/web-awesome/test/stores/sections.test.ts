import { afterAll, describe, expect, it, vi } from "vitest";

const globals = globalThis as typeof globalThis & { allureReportOptions?: unknown };

const originalHash = vi.hoisted(() => {
  const hash = window.location.hash;

  window.location.hash = "#metrics";
  (globalThis as typeof globalThis & { allureReportOptions?: unknown }).allureReportOptions = {
    sections: ["charts", "timeline"],
  };

  return hash;
});

import { availableSections, currentSection } from "@/stores/sections";

describe("sections store", () => {
  afterAll(() => {
    delete globals.allureReportOptions;
    window.location.hash = originalHash;
  });

  it("normalizes direct links to disabled sections", () => {
    expect(availableSections).toEqual(["charts", "timeline"]);
    expect(currentSection.value).toBe("default");
  });
});

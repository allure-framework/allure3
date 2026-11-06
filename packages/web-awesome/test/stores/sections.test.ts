import { afterAll, describe, expect, it, vi } from "vite-plus/test";

const globals = globalThis as typeof globalThis & { allureReportOptions?: unknown };

const originalHash = vi.hoisted(() => {
  const hash = window.location.hash;

  window.location.hash = "#metrics";
  (globalThis as typeof globalThis & { allureReportOptions?: unknown }).allureReportOptions = {
    sections: ["charts", "timeline"],
  };

  return hash;
});

import { navigateToInsights, navigateToRoot, navigateToRootTabRoot, navigateToSection } from "@/stores/router";
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

  it("keeps Insights, Results, and other report tabs in the default report section", () => {
    navigateToSection({ section: "charts" });
    expect(currentSection.value).toBe("charts");

    navigateToInsights();
    expect(currentSection.value).toBe("default");

    navigateToRoot();
    expect(currentSection.value).toBe("default");

    navigateToRootTabRoot({ rootTab: "globalErrors" });
    expect(currentSection.value).toBe("default");
  });
});

import { createRoute } from "@allurereport/web-commons";
import { computed } from "@preact/signals";

const noMatchRoute = createRoute<{}>("", {
  validate: () => false,
});

const sections = ["charts", "timeline"] as const;

const isSection = (param?: string): param is (typeof sections)[number] => sections.includes(param as any);

const trRoute = createRoute<{ testResultId: string }>(":testResultId", {
  validate: (parts, params) => {
    const { testResultId } = params;

    if (!testResultId) {
      return false;
    }

    if (isSection(testResultId)) {
      return false;
    }

    return true;
  },
});

const trWithTabsRoute = createRoute<{ testResultId: string; trTab: string }>(":testResultId/:trTab", {
  validate: (parts, params) => {
    const { testResultId, trTab } = params;

    if (!testResultId || !trTab) {
      return false;
    }

    if (isSection(testResultId)) {
      return false;
    }

    return true;
  },
});

export const sectionRoute = createRoute<{ section: string }>(":section", {
  validate: (parts, params) => {
    const { section } = params;

    return isSection(section);
  },
});

export const testResultRoute = computed(() => {
  if (trRoute.value.matches) {
    return trRoute.value as typeof trWithTabsRoute.value;
  }

  if (trWithTabsRoute.value.matches) {
    return trWithTabsRoute.value;
  }

  return noMatchRoute.value as typeof trWithTabsRoute.value;
});

export const currentRoute = computed(() => {
  if (sectionRoute.value.matches) {
    return "section";
  }

  if (testResultRoute.value.matches) {
    return "testResult";
  }

  return "noMatch";
});

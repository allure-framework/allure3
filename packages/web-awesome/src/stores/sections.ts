import { createRoute, getReportOptions, navigateTo, persistSignal, restoreSignal } from "@allurereport/web-commons";
import { computed, effect, signal } from "@preact/signals";
import type { AwesomeReportOptions } from "../../types.js";

const DEFAULT_SECTION = "default";
type Section = "default" | "charts" | "timeline";

export const availableSections = getReportOptions<AwesomeReportOptions>()?.sections ?? [];

const chosenSection = signal<Section>(DEFAULT_SECTION);

restoreSignal({
  signal: chosenSection,
  key: "chosenSection",
  onRestore: (value) => {
    if (availableSections.includes(value)) {
      return value;
    }

    const configSection = getReportOptions<AwesomeReportOptions>()?.defaultSection ?? DEFAULT_SECTION;

    return configSection;
  },
  defaultValue: getReportOptions<AwesomeReportOptions>()?.defaultSection ?? "",
});

const sectionRoute = createRoute<{ section: Section }>(":section");

const urlSection = computed(() => {
  const section = sectionRoute.value.params.section;

  if (availableSections.includes(section)) {
    return section;
  }

  return undefined;
});

export const currentSection = computed<Section>(() => {
  if (urlSection.value) {
    return urlSection.value;
  }

  return DEFAULT_SECTION;
});

effect(() => {
  const section = currentSection.value;
  document.documentElement.setAttribute("data-section", section);
});

persistSignal({
  signal: chosenSection,
  key: "chosenSection",
});

export const setSection = (section: Section): void => {
  chosenSection.value = section;
};

effect(() => {
  const section = chosenSection.value;

  if (section === DEFAULT_SECTION) {
    navigateTo({ path: "" });
    return;
  }

  navigateTo({ path: section });
});

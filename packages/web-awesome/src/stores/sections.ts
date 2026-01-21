import { getReportOptions } from "@allurereport/web-commons";
import { computed, effect, signal } from "@preact/signals";
import type { AwesomeReportOptions } from "../../types.js";
import { navigateToRoot, navigateToSection, rootRoute, sectionRoute } from "./router";

const DEFAULT_SECTION = "default";

type Section = "timeline" | "charts" | "default";

const defaultSectionFromReportOptions = getReportOptions<AwesomeReportOptions>()?.defaultSection ?? "default";

const onInit = () => {
  if (rootRoute.peek().matches && defaultSectionFromReportOptions !== DEFAULT_SECTION) {
    navigateToSection({ section: defaultSectionFromReportOptions as "timeline" | "charts" });
  }
};

onInit();

export const currentSection = computed(() => sectionRoute.value.params.section ?? "default");

export const availableSections = signal<Section[]>(
  (getReportOptions<AwesomeReportOptions>()?.sections ?? []) as Section[],
);

effect(() => {
  const section = currentSection.value;

  if (section) {
    document.documentElement.setAttribute("data-section", section);
  }
});

export const setSection = (chosenSection: Section | string): void => {
  const isDefaultSection = chosenSection === DEFAULT_SECTION;
  const isValidSection = availableSections.peek().includes(chosenSection as Section);
  const isSectionChanged = currentSection.peek() !== chosenSection;

  if (isDefaultSection) {
    navigateToRoot();
    return;
  }

  if (isSectionChanged && isValidSection) {
    navigateToSection({ section: chosenSection as "timeline" | "charts" });
  }
};

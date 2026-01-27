import { getReportOptions } from "@allurereport/web-commons";
import { computed, effect } from "@preact/signals";
import type { AwesomeReportOptions } from "../../types.js";
import { navigateToRoot, navigateToSection, sectionRoute } from "./router";

const DEFAULT_SECTION = "default";

type Section = "timeline" | "charts" | "default";

const reportOptions = getReportOptions<AwesomeReportOptions>();
const defaultSectionFromReportOptions: Section = (reportOptions?.defaultSection as Section) ?? "default";

export const availableSections = (reportOptions?.sections ?? []) as Section[];

const onInit = () => {
  const isSectionRoute = sectionRoute.peek().matches;
  const isDefaultSection = defaultSectionFromReportOptions === DEFAULT_SECTION;
  const isValidSection = availableSections.includes(defaultSectionFromReportOptions);

  if (!isSectionRoute && !isDefaultSection && isValidSection) {
    navigateToSection({ section: defaultSectionFromReportOptions });
  }
};

onInit();

export const currentSection = computed(() => sectionRoute.value.params.section ?? "default");

effect(() => {
  const section = currentSection.value;

  if (section) {
    document.documentElement.setAttribute("data-section", section);
  }
});

export const setSection = (chosenSection: Section | string): void => {
  const isDefaultSection = chosenSection === DEFAULT_SECTION;
  const isValidSection = availableSections.includes(chosenSection as Section);
  const isSectionChanged = currentSection.peek() !== chosenSection;

  if (isDefaultSection) {
    navigateToRoot();
    return;
  }

  if (isSectionChanged && isValidSection) {
    navigateToSection({ section: chosenSection as "timeline" | "charts" });
  }
};

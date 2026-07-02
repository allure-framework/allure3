import { getReportOptions } from "@allurereport/web-commons";
import { computed, effect } from "@preact/signals";

import type { AwesomeReportOptions } from "../../types.js";
import { navigateToRoot, navigateToSection, SECTION_ROUTE_NAMES, sectionRoute, type SectionRouteName } from "./router";

const DEFAULT_SECTION = "default";

type Section = SectionRouteName | "default";

const reportOptions = getReportOptions<AwesomeReportOptions>();
const isKnownSection = (value: unknown): value is SectionRouteName =>
  SECTION_ROUTE_NAMES.includes(value as SectionRouteName);
const resolveDefaultSection = (value: unknown): Section =>
  value === DEFAULT_SECTION || isKnownSection(value) ? value : DEFAULT_SECTION;

const configuredSections = Array.isArray(reportOptions?.sections) ? reportOptions.sections : [];
const defaultSectionFromReportOptions = resolveDefaultSection(reportOptions?.defaultSection);

export const availableSections = configuredSections.filter(isKnownSection);

const onInit = () => {
  const isSectionRoute = sectionRoute.peek().matches;
  const isDefaultSection = defaultSectionFromReportOptions === DEFAULT_SECTION;
  const isValidSection = availableSections.includes(defaultSectionFromReportOptions);

  if (!isSectionRoute && !isDefaultSection && isValidSection) {
    navigateToSection({ section: defaultSectionFromReportOptions });
  }
};

onInit();

export const currentSection = computed(() =>
  sectionRoute.value.matches ? (sectionRoute.value.params.section ?? "default") : "default",
);

effect(() => {
  const section = currentSection.value;

  if (section) {
    document.documentElement.setAttribute("data-section", section);
  }
});

export const setSection = (chosenSection: Section | string): void => {
  const isDefaultSection = chosenSection === DEFAULT_SECTION;
  const isValidSection = isKnownSection(chosenSection) && availableSections.includes(chosenSection);
  const isSectionChanged = currentSection.peek() !== chosenSection;

  if (isDefaultSection) {
    navigateToRoot();
    return;
  }

  if (isSectionChanged && isValidSection) {
    navigateToSection({ section: chosenSection });
  }
};

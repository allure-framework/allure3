import { getReportOptions } from "@allurereport/web-commons";
import { computed, effect } from "@preact/signals";

import type { AwesomeReportOptions } from "../../types.js";
import { navigateToRoot, navigateToSection, SECTION_ROUTE_NAMES, sectionRoute, type SectionRouteName } from "./router";

const DEFAULT_SECTION = "default";

type Section = SectionRouteName | DEFAULT_SECTION;

const reportOptions = getReportOptions<AwesomeReportOptions>();

const isKnownSection = (value: unknown): value is SectionRouteName =>
  SECTION_ROUTE_NAMES.includes(value as SectionRouteName);

const configuredSections = Array.isArray(reportOptions?.sections) ? reportOptions.sections : [];

export const availableSections = configuredSections.filter(isKnownSection);

const normalizeSection = (value: unknown): Section =>
  value === DEFAULT_SECTION || (isKnownSection(value) && availableSections.includes(value)) ? value : DEFAULT_SECTION;

const defaultSectionFromReportOptions = normalizeSection(reportOptions?.defaultSection);

const onInit = () => {
  const isSectionRoute = sectionRoute.peek().matches;
  const section = normalizeSection(defaultSectionFromReportOptions);

  if (!isSectionRoute && section !== DEFAULT_SECTION) {
    navigateToSection({ section });
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
  const section = normalizeSection(chosenSection);
  const isSectionChanged = currentSection.peek() !== section;

  if (section === DEFAULT_SECTION) {
    navigateToRoot();
    return;
  }

  if (isSectionChanged) {
    navigateToSection({ section });
  }
};

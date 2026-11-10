import { getReportOptions, router } from "@allurereport/web-commons";
import { computed, effect } from "@preact/signals";

import type { ReportOptions } from "../../types.js";
import { navigateToRoot, navigateToSection, SECTION_ROUTE_NAMES, sectionRoute, type SectionRouteName } from "./router";

const DEFAULT_SECTION = "default";

type Section = SectionRouteName | "default";

const reportOptions = getReportOptions<ReportOptions>();

const isKnownSection = (value: unknown): value is SectionRouteName =>
  SECTION_ROUTE_NAMES.includes(value as SectionRouteName);

const configuredSections = Array.isArray(reportOptions?.sections) ? reportOptions.sections : [];

export const availableSections = [...new Set(configuredSections.filter(isKnownSection))];

const normalizeSection = (value: unknown): Section =>
  value === DEFAULT_SECTION || (isKnownSection(value) && availableSections.includes(value)) ? value : DEFAULT_SECTION;

const defaultSection = normalizeSection(reportOptions?.defaultSection);

if (router.peek().pathParts.length === 0 && defaultSection !== DEFAULT_SECTION) {
  navigateToSection({ section: defaultSection });
}

export const currentSection = computed(() =>
  sectionRoute.value.matches ? normalizeSection(sectionRoute.value.params.section) : DEFAULT_SECTION,
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

import { getReportOptions } from "@allurereport/web-commons";
import { effect, signal } from "@preact/signals";
import { navigateTo, parseHash, route } from "@/stores/router";
import type { AwesomeReportOptions } from "../../types.js";

const DEFAULT_SECTION = "default";
type Section = string;

export const currentSection = signal<Section>("");
export const availableSections = signal<Section[]>([]);

const updateSectionState = (section: Section): void => {
  currentSection.value = section;
  document.documentElement.setAttribute("data-section", section);
  globalThis.localStorage.setItem("chosenSection", section);
};

export const setSection = (chosenSection: Section): void => {
  const isDefaultSection = chosenSection === DEFAULT_SECTION;
  const isValidSection = availableSections.value?.includes(chosenSection);
  const isSectionChanged = currentSection.value !== chosenSection;

  updateSectionState(chosenSection);

  if (isDefaultSection) {
    navigateTo({ category: "" });
    return;
  }

  if (isSectionChanged && isValidSection) {
    navigateTo({ category: chosenSection });
  }
};

export const getSection = () => {
  const { category } = parseHash();
  availableSections.value = getReportOptions<AwesomeReportOptions>()?.sections ?? [];
  const defaultSectionFromReportOptions = getReportOptions<AwesomeReportOptions>()?.defaultSection ?? "";
  const sectionFromUrl = parseHash().category;
  const sectionFromLS =
    globalThis.localStorage.getItem("chosenSection") === ""
      ? ""
      : globalThis.localStorage.getItem("chosenSection") || defaultSectionFromReportOptions;
  currentSection.value = sectionFromUrl || sectionFromLS;

  if (category) {
    setSection(category);
    return;
  }

  if (sectionFromLS) {
    setSection(sectionFromLS);
    return;
  }

  setSection("");
};

effect(() => {
  const category = route.value.category;

  setSection(category || "");
});

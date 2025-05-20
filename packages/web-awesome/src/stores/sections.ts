import { getReportOptions } from "@allurereport/web-commons";
import { effect, signal } from "@preact/signals";
import { navigateTo, parseHash, route } from "@/stores/router";
import type { AwesomeReportOptions } from "../../types.js";

type Section = string;

const sectionsFromReportOption = getReportOptions<AwesomeReportOptions>()?.sections ?? [];
const defaultSectionFromReportOptions = getReportOptions<AwesomeReportOptions>()?.defaultSection ?? "";

const sectionFromUrl = parseHash().category;
const sectionFromLS =
  globalThis.localStorage.getItem("chosenSection") === ""
    ? ""
    : globalThis.localStorage.getItem("chosenSection") || defaultSectionFromReportOptions;

export const currentSection = signal<Section>(sectionFromUrl || sectionFromLS);
export const availableSections = signal<Section[]>(sectionsFromReportOption);

export const setSection = (chosenSection: Section): void => {
  if (currentSection.value !== chosenSection) {
    navigateTo({ category: chosenSection });
  }
  currentSection.value = chosenSection;
  document.documentElement.setAttribute("data-section", chosenSection);
  globalThis.localStorage.setItem("chosenSection", chosenSection);
};

export const getSection = () => {
  const { category } = parseHash();

  if (category) {
    setSection(category);
    return;
  }
  // if (!defaultSection) {
  //   return;
  // }

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

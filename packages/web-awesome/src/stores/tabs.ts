import { signal } from "@preact/signals";

export const currentTab = signal<string | undefined>("total");

export const setCurrentTab = (tab: string) => {
  currentTab.value = tab;
};

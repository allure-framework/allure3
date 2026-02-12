import { themeStore, toggleUserTheme } from "@allurereport/web-commons";
import { ThemeButton as UIThemeButton } from "@allurereport/web-components";
import { computed } from "@preact/signals";

const selectedTheme = computed(() => themeStore.value.selected);

export const ThemeButton = () => {
  return <UIThemeButton theme={selectedTheme.value} toggleTheme={toggleUserTheme} />;
};

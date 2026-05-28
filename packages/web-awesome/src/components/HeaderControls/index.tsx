import { themeStore, toggleUserTheme } from "@allurereport/web-commons";
import { ThemeButton } from "@allurereport/web-components";
import { computed } from "@preact/signals";

import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import ToggleLayout from "@/components/ToggleLayout";

interface HeaderControlsProps {
  className?: string;
}

const selectedTheme = computed(() => themeStore.value.selected);

export const HeaderControls = ({ className }: HeaderControlsProps) => {
  return (
    <div className={className}>
      <EnvironmentPicker />
      <ToggleLayout />
      <ThemeButton theme={selectedTheme.value} toggleTheme={toggleUserTheme} />
    </div>
  );
};

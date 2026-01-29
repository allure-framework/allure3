import { themeStore, toggleUserTheme } from "@allurereport/web-commons";
import { LanguagePicker, ThemeButton } from "@allurereport/web-components";
import { computed } from "@preact/signals";
import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import ToggleLayout from "@/components/ToggleLayout";
import { currentLocale, setLocale } from "@/stores/locale";

interface HeaderControlsProps {
  className?: string;
}

const selectedTheme = computed(() => themeStore.value.selected);

export const HeaderControls = ({ className }: HeaderControlsProps) => {
  return (
    <div className={className}>
      <EnvironmentPicker />
      <LanguagePicker locale={currentLocale.value} setLocale={setLocale} />
      <ToggleLayout />
      <ThemeButton theme={selectedTheme.value} toggleTheme={toggleUserTheme} />
    </div>
  );
};

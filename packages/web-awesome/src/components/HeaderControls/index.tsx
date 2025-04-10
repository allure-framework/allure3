import { LanguagePicker, ThemeButton } from "@allurereport/web-components";
import { currentLocale, setLocale } from "@/stores/locale";
import { getTheme, themeStore, toggleTheme } from "@/stores/theme";
import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import ToggleLayout from "@/components/ToggleLayout";

interface HeaderControlsProps {
    className?: string;
}

export const HeaderControls = ({ className }: HeaderControlsProps) => {
    return (
        <div className={className}>
            <EnvironmentPicker />
            <LanguagePicker locale={currentLocale.value} setLocale={setLocale} />
            <ToggleLayout />
            <ThemeButton theme={themeStore.value} toggleTheme={toggleTheme} getTheme={getTheme} />
        </div>
    );
};

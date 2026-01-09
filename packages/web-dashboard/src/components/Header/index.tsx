import { themeStore, toggleUserTheme } from "@allurereport/web-commons";
import { LanguagePicker, ThemeButton } from "@allurereport/web-components";
import { computed } from "@preact/signals";
import type { ClassValue } from "clsx";
import clsx from "clsx";
import { currentLocale, setLocale } from "@/stores/locale";
import { EnvironmentPicker } from "../EnvironmentPicker";
import * as styles from "./styles.scss";

interface HeaderProps {
  className?: ClassValue;
}

const selectedTheme = computed(() => themeStore.value.selected);

export const Header = ({ className }: HeaderProps) => {
  return (
    <div className={clsx(styles.above, className)}>
      <div className={styles.right}>
        <EnvironmentPicker />
        <LanguagePicker locale={currentLocale.value} setLocale={setLocale} />
        <ThemeButton theme={selectedTheme.value} toggleTheme={toggleUserTheme} />
      </div>
    </div>
  );
};

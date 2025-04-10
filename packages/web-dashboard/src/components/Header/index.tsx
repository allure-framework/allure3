import type { ClassValue } from "clsx";
import clsx from "clsx";
import { LanguagePicker, ThemeButton } from "@allurereport/web-components";
import * as styles from "./styles.scss";
import { currentLocale, setLocale } from "@/stores/locale";
import { getTheme, themeStore, toggleTheme } from "@/stores/theme";

interface HeaderProps {
  className?: ClassValue;
}

export const Header = ({ className }: HeaderProps) => {
  return (
    <div className={clsx(styles.above, className)}>
      <div className={styles.right}>
        <LanguagePicker locale={currentLocale.value} setLocale={setLocale} />
        <ThemeButton theme={themeStore.value} toggleTheme={toggleTheme} getTheme={getTheme} />
      </div>
    </div>
  );
};

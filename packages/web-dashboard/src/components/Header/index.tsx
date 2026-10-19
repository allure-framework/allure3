import { getReportOptions, themeStore, toggleUserTheme } from "@allurereport/web-commons";
import { LanguagePicker, OverviewLink, ThemeButton } from "@allurereport/web-components/core";
import { computed } from "@preact/signals";
import type { ClassValue } from "clsx";
import clsx from "clsx";
import type { ReportOptions } from "types";

import { currentLocale, setLocale, useI18n } from "@/stores/locale";

import { EnvironmentPicker } from "../EnvironmentPicker";

import * as styles from "./styles.scss";

interface HeaderProps {
  className?: ClassValue;
}

const selectedTheme = computed(() => themeStore.value.selected);

export const Header = ({ className }: HeaderProps) => {
  const { t } = useI18n("controls");
  const { overviewHref } = getReportOptions<ReportOptions>() ?? {};

  return (
    <div className={clsx(styles.above, className)}>
      {overviewHref && <OverviewLink href={overviewHref} text={t("backToOverview")} />}
      <div className={styles.right}>
        <EnvironmentPicker />
        <LanguagePicker locale={currentLocale.value} setLocale={setLocale} />
        <ThemeButton theme={selectedTheme.value} toggleTheme={toggleUserTheme} />
      </div>
    </div>
  );
};

import type { ClassValue } from "clsx";
import clsx from "clsx";
import { LanguagePicker } from "@/components/LanguagePicker";
import { TestResultBreadcrumbs } from "@/components/TestResult/TestResultHeader/TestResultBreadcrumbs";
import { ThemeButton } from "@/components/ThemeButton/ThemeButton";
import ToggleLayout from "@/components/ToggleLayout";
import { route } from "@/stores/router";
import { testResultStore } from "@/stores/testResults";
import * as styles from "./styles.scss";

interface HeaderProps {
  className?: ClassValue;
}

export const Header = ({ className }: HeaderProps) => {
  const { id } = route.value;

  return (
    <div className={clsx(styles.above, className)}>
      {id && <TestResultBreadcrumbs testResult={testResultStore.value?.data?.[id]} />}
      <div className={styles.right}>
        <LanguagePicker />
        <ToggleLayout />
        <ThemeButton />
      </div>
    </div>
  );
};

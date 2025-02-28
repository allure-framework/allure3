import type { FunctionalComponent } from "preact";
import { LanguagePicker } from "@/components/LanguagePicker";
import type { TestResultProps } from "@/components/TestResult";
import { TestResultBreadcrumbs } from "@/components/TestResult/TestResultHeader/TestResultBreadcrumbs";
import { ThemeButton } from "@/components/ThemeButton/ThemeButton";
import ToggleLayout from "@/components/ToggleLayout";
import { isSplitMode } from "@/stores/layout";
import * as styles from "./styles.scss";

export const TestResultHeader: FunctionalComponent<TestResultProps> = ({ testResult }) => {
  return (
    <div className={styles.above}>
      {!isSplitMode.value ? <TestResultBreadcrumbs testResult={testResult} /> : ""}
      <div className={styles.right}>
        <LanguagePicker />
        <ToggleLayout />
        <ThemeButton />
      </div>
    </div>
  );
};

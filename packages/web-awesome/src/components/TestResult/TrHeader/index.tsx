import type { FunctionalComponent } from "preact";
import { LanguagePicker } from "@/components/LanguagePicker";
import type { TestResultProps } from "@/components/TestResult";
import { TrBreadcrumbs } from "@/components/TestResult/TrHeader/TrBreadcrumbs";
import { ThemeButton } from "@/components/ThemeButton/ThemeButton";
import ToggleLayout from "@/components/ToggleLayout";
import { isSplitMode } from "@/stores/layout";
import * as styles from "./styles.scss";

export const TrHeader: FunctionalComponent<TestResultProps> = ({ testResult }) => {
  return (
    <div className={styles.above}>
      {!isSplitMode.value ? <TrBreadcrumbs testResult={testResult} /> : ""}
      <div className={styles.right}>
        <LanguagePicker />
        <ToggleLayout />
        <ThemeButton />
      </div>
    </div>
  );
};

import type { FunctionalComponent } from "preact";
import type { TrProps } from "@/components/TestResult";
import { TrBreadcrumbs } from "@/components/TestResult/TrHeader/TrBreadcrumbs";
import { isSplitMode } from "@/stores/layout";
import * as styles from "./styles.scss";
import { HeaderControls } from "@/components/HeaderControls";

export const TrHeader: FunctionalComponent<TrProps> = ({ testResult }) => {
  return (
    <div className={styles.above}>
      {!isSplitMode.value ? <TrBreadcrumbs testResult={testResult} /> : ""}
      <HeaderControls className={styles.right} />
    </div>
  );
};

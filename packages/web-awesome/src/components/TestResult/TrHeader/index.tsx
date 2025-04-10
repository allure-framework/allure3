import type { FunctionalComponent } from "preact";
import { HeaderControls } from "@/components/HeaderControls";
import type { TrProps } from "@/components/TestResult";
import { TrBreadcrumbs } from "@/components/TestResult/TrHeader/TrBreadcrumbs";
import { isSplitMode } from "@/stores/layout";
import * as styles from "./styles.scss";

export const TrHeader: FunctionalComponent<TrProps> = ({ testResult }) => {
  return (
    <div className={styles.above}>
      {!isSplitMode.value ? <TrBreadcrumbs testResult={testResult} /> : ""}
      <HeaderControls className={styles.right} />
    </div>
  );
};

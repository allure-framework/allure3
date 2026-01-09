import type { ClassValue } from "clsx";
import clsx from "clsx";
import { HeaderControls } from "@/components/HeaderControls";
import { SectionPicker } from "@/components/SectionPicker";
import { TrBreadcrumbs } from "@/components/TestResult/TrHeader/TrBreadcrumbs";
import { availableSections } from "@/stores/sections";
import { testResultIdStore } from "@/stores/testResult";
import { testResultStore } from "@/stores/testResults";
import { CiInfo } from "./CiInfo";
import * as styles from "./styles.scss";

interface HeaderProps {
  className?: ClassValue;
}

export const Header = ({ className }: HeaderProps) => {
  const testResultId = testResultIdStore.value;

  return (
    <div className={clsx(styles.above, className)}>
      {availableSections.length > 0 && <SectionPicker />}
      {!testResultId && <CiInfo />}
      {testResultId && <TrBreadcrumbs testResult={testResultStore.value?.data?.[testResultId]} />}
      <HeaderControls className={styles.right} />
    </div>
  );
};

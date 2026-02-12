import { computed } from "@preact/signals";
import type { ClassValue } from "clsx";
import clsx from "clsx";
import { HeaderControls } from "@/components/HeaderControls";
import { SectionPicker } from "@/components/SectionPicker";
import { TrBreadcrumbs } from "@/components/TestResult/TrHeader/TrBreadcrumbs";
import { testResultRoute } from "@/stores/router";
import { currentTrId } from "@/stores/testResult";
import { testResultStore } from "@/stores/testResults";
import { CiInfo } from "./CiInfo";
import * as styles from "./styles.scss";

interface HeaderProps {
  className?: ClassValue;
}

const isTestResultRoute = computed(() => testResultRoute.value.matches);
const testResult = computed(() => testResultStore.value?.data?.[currentTrId.value]);

export const Header = ({ className }: HeaderProps) => {
  return (
    <div className={clsx(styles.above, className)}>
      <SectionPicker />
      {!isTestResultRoute.value && <CiInfo />}
      {isTestResultRoute.value && <TrBreadcrumbs testResult={testResult.value} />}
      <HeaderControls className={styles.right} />
    </div>
  );
};

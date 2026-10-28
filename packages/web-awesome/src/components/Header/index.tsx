import { computed } from "@preact/signals";
import type { ClassValue } from "clsx";
import clsx from "clsx";

import { HeaderControls } from "@/components/HeaderControls";
import { SectionPicker } from "@/components/SectionPicker";
import { TrBreadcrumbs } from "@/components/TestResult/TrHeader/TrBreadcrumbs";
import { rootTabRoute, testResultRoute } from "@/stores/router";
import { currentTrId } from "@/stores/testResult";
import { testResultStore } from "@/stores/testResults";

import { GitInfo } from "./GitInfo";
import { OverviewLink } from "./OverviewLink";

import * as styles from "./styles.scss";

interface HeaderProps {
  className?: ClassValue;
}

const isTestResultRoute = computed(() => testResultRoute.value.matches || !!rootTabRoute.value.params.testResultId);
const testResult = computed(() => (currentTrId.value ? testResultStore.value?.data?.[currentTrId.value] : undefined));

export const Header = ({ className }: HeaderProps) => {
  return (
    <div className={clsx(styles.above, className)}>
      <OverviewLink />
      <SectionPicker />
      {!isTestResultRoute.value && <GitInfo />}
      {isTestResultRoute.value && <TrBreadcrumbs testResult={testResult.value} />}
      <HeaderControls className={styles.right} />
    </div>
  );
};

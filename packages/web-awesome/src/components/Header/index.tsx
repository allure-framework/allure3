import type { ClassValue } from "clsx";
import clsx from "clsx";
import { HeaderControls } from "@/components/HeaderControls";
import { SectionPicker } from "@/components/SectionPicker";
import { TrBreadcrumbs } from "@/components/TestResult/TrHeader/TrBreadcrumbs";
import { route } from "@/stores/router";
import { availableSections } from "@/stores/sections";
import { testResultStore } from "@/stores/testResults";
import * as styles from "./styles.scss";

interface HeaderProps {
  className?: ClassValue;
}

export const Header = ({ className }: HeaderProps) => {
  const testResultId = route.value.params?.testResultId ?? null;

  return (
    <div className={clsx(styles.above, className)}>
      {Boolean(availableSections.value?.length) && <SectionPicker />}
      {testResultId && <TrBreadcrumbs testResult={testResultStore.value?.data?.[testResultId]} />}
      <HeaderControls className={styles.right} />
    </div>
  );
};

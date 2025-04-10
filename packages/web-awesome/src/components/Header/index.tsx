import type { ClassValue } from "clsx";
import clsx from "clsx";
import { HeaderControls } from "@/components/HeaderControls";
import { TrBreadcrumbs } from "@/components/TestResult/TrHeader/TrBreadcrumbs";
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
      {id && <TrBreadcrumbs testResult={testResultStore.value?.data?.[id]} />}
      <HeaderControls className={styles.right} />
    </div>
  );
};

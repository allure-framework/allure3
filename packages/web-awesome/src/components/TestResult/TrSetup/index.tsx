import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";

import { fixtureResultToTrStepItem } from "@/components/TestResult/bodyItems";
import { TrDropdown } from "@/components/TestResult/TrDropdown";
import { TrStep } from "@/components/TestResult/TrSteps/TrStep";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

export type TrSetupProps = {
  setup: AwesomeTestResult["setup"];
  id?: string;
};

export const TrSetup: FunctionalComponent<TrSetupProps> = ({ setup, id }) => {
  const teardownId = `${id}-setup`;
  const isEarlyCollapsed = Boolean(!collapsedTrees.value.has(teardownId));
  const [isOpened, setIsOpen] = useState<boolean>(isEarlyCollapsed);

  const handleClick = () => {
    setIsOpen(!isOpened);
    toggleTree(teardownId);
  };
  const { t } = useI18n("execution");

  return (
    <div className={styles["test-result-steps"]}>
      <TrDropdown
        icon={allureIcons.lineTimeClockStopwatch}
        isOpened={isOpened}
        setIsOpen={handleClick}
        counter={setup?.length}
        title={t("setup")}
      />
      {isOpened && (
        <div className={styles["test-result-steps-root"]}>
          {setup?.map((fixture, key) => (
            <div className={styles["test-result-step-root"]} key={fixture.id}>
              <TrStep item={fixtureResultToTrStepItem(fixture)} stepIndex={key + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

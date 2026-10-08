import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { ReportTestResult } from "types";

import { fixtureResultToTrStepItem } from "@/components/TestResult/bodyItems";
import { TrDropdown } from "@/components/TestResult/TrDropdown";
import {
  getStepTreeExpansionPolicy,
  isOpenByDefaultForPolicy,
} from "@/components/TestResult/TrSteps/stepTreeExpansion";
import { TrStep } from "@/components/TestResult/TrSteps/TrStep";
import { useI18n } from "@/stores/locale";
import { isTreeOpened, toggleTree } from "@/stores/tree";
import { trOverviewFocusAttrs, trOverviewHeaderFocusClass } from "@/utils/trOverviewFocus";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

export type TrSetupProps = {
  setup: ReportTestResult["setup"];
  id?: string;
};

export const TrSetup: FunctionalComponent<TrSetupProps> = ({ setup, id }) => {
  const setupId = id ? `${id}-setup` : null;
  const openedByDefault = isOpenByDefaultForPolicy(getStepTreeExpansionPolicy(), true);
  const [isAnonymousOpened, setIsAnonymousOpened] = useState<boolean>(openedByDefault);
  const isOpened = setupId ? isTreeOpened(setupId, openedByDefault) : isAnonymousOpened;

  const handleClick = () => {
    if (setupId) {
      toggleTree(setupId, openedByDefault);
      return;
    }

    setIsAnonymousOpened(!isAnonymousOpened);
  };
  const { t } = useI18n("execution");

  return (
    <div className={styles["test-result-steps"]}>
      <TrDropdown
        data-testid="test-result-setup-dropdown"
        className={trOverviewHeaderFocusClass(setupId)}
        {...trOverviewFocusAttrs(setupId)}
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
              <TrStep item={fixtureResultToTrStepItem(fixture)} stepIndex={key + 1} isTopLevel={true} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

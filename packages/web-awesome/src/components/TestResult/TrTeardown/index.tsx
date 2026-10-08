import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
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

export type TrTeardownProps = {
  teardown: ReportTestResult["teardown"];
  id: string;
};

export const TrTeardown: FunctionalComponent<TrTeardownProps> = ({ teardown, id }) => {
  const teardownId = id ? `${id}-teardown` : null;
  const openedByDefault = isOpenByDefaultForPolicy(getStepTreeExpansionPolicy(), true);
  const isOpened = teardownId ? isTreeOpened(teardownId, openedByDefault) : openedByDefault;

  const handleClick = () => {
    if (teardownId) {
      toggleTree(teardownId, openedByDefault);
    }
  };

  const { t } = useI18n("execution");

  return (
    <div className={styles["test-result-steps"]}>
      <TrDropdown
        data-testid="test-result-teardown-dropdown"
        className={trOverviewHeaderFocusClass(teardownId)}
        {...trOverviewFocusAttrs(teardownId)}
        icon={allureIcons.lineHelpersFlag}
        isOpened={isOpened}
        setIsOpen={handleClick}
        counter={teardown?.length}
        title={t("teardown")}
      />
      {isOpened && (
        <div className={styles["test-result-steps-root"]}>
          {teardown?.map((fixture, key) => (
            <div className={styles["test-result-step-root"]} key={fixture.id}>
              <TrStep item={fixtureResultToTrStepItem(fixture)} stepIndex={key + 1} isTopLevel={true} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

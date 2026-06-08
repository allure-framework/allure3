import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";

import { fixtureResultToTrStepItem } from "@/components/TestResult/bodyItems";
import { TrDropdown } from "@/components/TestResult/TrDropdown";
import { TrStep } from "@/components/TestResult/TrSteps/TrStep";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";
import { trOverviewFocusAttrs, trOverviewHeaderFocusClass } from "@/utils/trOverviewFocus";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

export type TrTeardownProps = {
  teardown: AwesomeTestResult["teardown"];
  id: string;
};

export const TrTeardown: FunctionalComponent<TrTeardownProps> = ({ teardown, id }) => {
  const teardownId = id ? `${id}-teardown` : null;
  const isEarlyCollapsed = teardownId ? !collapsedTrees.value.has(teardownId) : true;
  const [isOpened, setIsOpen] = useState<boolean>(isEarlyCollapsed);

  const handleClick = () => {
    setIsOpen(!isOpened);

    if (teardownId) {
      toggleTree(teardownId);
    }
  };

  const { t } = useI18n("execution");

  return (
    <div className={styles["test-result-steps"]}>
      <TrDropdown
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

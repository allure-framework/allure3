import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { TrDropdown } from "@/components/TestResult/TrDropdown";
import { TrAttachment } from "@/components/TestResult/TrSteps/TrAttachment";
import { TrStep } from "@/components/TestResult/TrSteps/TrStep";
import * as styles from "@/components/TestResult/TrSteps/styles.scss";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";

const typeMap = {
  before: TrStep,
  after: TrStep,
  step: TrStep,
  attachment: TrAttachment,
};

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
          {setup?.map((item, key) => {
            const StepComponent = typeMap[item.type];
            return StepComponent ? (
              // FIXME: use proper type in the StepComponent component
              // @ts-ignore
              <StepComponent item={item} stepIndex={key + 1} key={key} className={styles["test-result-step-root"]} />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};

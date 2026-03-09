import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult, AwesomeTestStepResult } from "types";

import { TrDropdown } from "@/components/TestResult/TrDropdown";
import { TrAttachment } from "@/components/TestResult/TrSteps/TrAttachment";
import { TrStep } from "@/components/TestResult/TrSteps/TrStep";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "./styles.scss";

const typeMap = {
  step: TrStep,
  attachment: TrAttachment,
} as const;

export type TrStepsProps = {
  steps: AwesomeTestResult["steps"];
  id?: string;
};

type StepComponentProps = FunctionalComponent<{
  item?: AwesomeTestStepResult;
  stepIndex?: number;
}>;

export const TrSteps: FunctionalComponent<TrStepsProps> = ({ steps, id }) => {
  const stepsId = id !== null ? `${id}-steps` : null;
  const isOpened = !collapsedTrees.value.has(stepsId);

  const handleClick = () => {
    if (stepsId !== null) {
      toggleTree(stepsId);
    }
  };

  const { t } = useI18n("execution");
  return (
    <div className={styles["test-result-steps"]}>
      <TrDropdown
        icon={allureIcons.lineHelpersPlayCircle}
        isOpened={isOpened}
        setIsOpen={() => stepsId !== null && toggleTree(stepsId)}
        counter={steps?.length}
        title={t("body")}
      />
      {isOpened && (
        <div className={styles["test-result-steps-root"]}>
          {steps?.map((item: AwesomeTestStepResult, index) => {
            const { type } = item;
            const StepComponent: StepComponentProps = typeMap[type];
            return StepComponent ? <StepComponent item={item} stepIndex={index + 1} key={index} /> : null;
          })}
        </div>
      )}
    </div>
  );
};

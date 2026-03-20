import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";

import type { TrBodyItem } from "@/components/TestResult/bodyItems";
import { TrDropdown } from "@/components/TestResult/TrDropdown";
import { TrBodyItems } from "@/components/TestResult/TrSteps/TrBodyItems";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "./styles.scss";

export type TrStepsProps = {
  bodyItems: TrBodyItem[];
  id?: string;
};

export const TrSteps: FunctionalComponent<TrStepsProps> = ({ bodyItems, id }) => {
  const stepsId = id !== null ? `${id}-steps` : null;
  const isOpened = !collapsedTrees.value.has(stepsId);

  const { t } = useI18n("execution");
  return (
    <div className={styles["test-result-steps"]}>
      <TrDropdown
        icon={allureIcons.lineHelpersPlayCircle}
        isOpened={isOpened}
        setIsOpen={() => stepsId !== null && toggleTree(stepsId)}
        counter={bodyItems.length}
        title={t("body")}
      />
      {isOpened && (
        <div data-testid="test-result-steps-root" className={styles["test-result-steps-root"]}>
          <TrBodyItems bodyItems={bodyItems} />
        </div>
      )}
    </div>
  );
};

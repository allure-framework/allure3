import type { TestStatus } from "@allurereport/core-api";
import { ArrowButton, Code, Text, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import type { FunctionComponent } from "preact";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

export type TrStepHeaderProps = {
  title: string;
  status: TestStatus;
  stepIndex?: number;
  isOpened: boolean;
  hasContent: boolean;
  onToggle: () => void;
  extra?: preact.ComponentChildren;
};

export const TrStepHeader: FunctionComponent<TrStepHeaderProps> = ({
  title,
  status,
  stepIndex,
  isOpened,
  hasContent,
  onToggle,
  extra,
}) => (
  <div
    data-testid="test-result-step-header"
    className={styles["test-result-step-header"]}
    onClick={hasContent ? onToggle : undefined}
  >
    {!hasContent ? (
      <div className={styles["test-result-strut"]} />
    ) : (
      <ArrowButton
        isOpened={isOpened}
        icon={allureIcons.arrowsChevronDown}
        iconSize="xs"
        data-testid="test-result-step-arrow-button"
      />
    )}
    <TreeItemIcon status={status} />
    <Code size="s" className={styles["test-result-step-number"]}>
      {stepIndex}
    </Code>
    <Text data-testid="test-result-step-title" className={styles["test-result-header-text"]}>
      {title}
    </Text>
    {extra}
  </div>
);

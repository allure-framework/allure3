import type { TestStatus } from "@allurereport/core-api";
import { ArrowButton, Code, LinkifiedText, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
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
  subtreeToggle?: preact.ComponentChildren;
  className?: string;
};

export const TrStepHeader: FunctionComponent<TrStepHeaderProps> = ({
  title,
  status,
  stepIndex,
  isOpened,
  hasContent,
  onToggle,
  extra,
  subtreeToggle,
  className,
  ...rest
}) => (
  <div
    data-testid="test-result-step-header"
    className={clsx(styles["test-result-step-header"], className)}
    onClick={hasContent ? onToggle : undefined}
    {...rest}
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
    <LinkifiedText data-testid="test-result-step-title" className={styles["test-result-header-text"]} text={title} />
    {subtreeToggle}
    {extra}
  </div>
);

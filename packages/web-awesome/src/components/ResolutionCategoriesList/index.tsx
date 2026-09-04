import { type ResolutionCategory } from "@allurereport/core-api";
import { ArrowButton, SvgIcon, Text, TreeItem, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { ReportResolutionGroup, ReportResolutionTestResult } from "types";

import { useI18n } from "@/stores/locale";
import { navigateToTestResult } from "@/stores/router";

import * as styles from "./styles.scss";

export type ResolutionCategoriesListProps = {
  groups: ReportResolutionGroup[];
  showTests?: boolean;
  emptyText: string;
  compact?: boolean;
};

const resolutionIcons: Record<ResolutionCategory, string> = {
  issue: allureIcons.lineDevBug2,
  muted: allureIcons.lineGeneralEye,
  accepted: allureIcons.lineGeneralCheckCircle,
};

const getResolutionTitle = (
  group: ReportResolutionGroup,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  if (group.resolution === "issue") {
    return group.issue?.id ?? group.name;
  }

  return t(`resolutions.${group.resolution}`);
};

export const ResolutionCategoriesList: FunctionalComponent<ResolutionCategoriesListProps> = ({
  groups,
  showTests = false,
  emptyText,
  compact = false,
}) => {
  if (!groups.length) {
    return <div className={styles["resolution-categories-empty"]}>{emptyText}</div>;
  }

  return (
    <ul
      className={clsx(
        styles["resolution-categories-list"],
        compact ? styles["resolution-categories-list-compact"] : styles["resolution-categories-list-full"],
      )}
    >
      {groups.map((group) => (
        <ResolutionCategoriesItem compact={compact} group={group} key={group.id} showTests={showTests} />
      ))}
    </ul>
  );
};

const ResolutionCategoriesItem: FunctionalComponent<{
  group: ReportResolutionGroup;
  showTests: boolean;
  compact: boolean;
}> = ({ group, showTests, compact }) => {
  const hasTests = showTests && Boolean(group.testResults.length);
  const [isOpened, setIsOpened] = useState(true);
  const { t } = useI18n("filters");
  const title = getResolutionTitle(group, t);
  const subtitle = group.comment ?? group.issue?.comment;
  const toggle = () => setIsOpened((value) => !value);
  const headerContent = (
    <>
      {hasTests ? (
        <ArrowButton tag="span" buttonSize="s" className={styles["resolution-categories-arrow"]} isOpened={isOpened} />
      ) : (
        <span className={styles["resolution-categories-arrow-spacer"]} />
      )}
      <SvgIcon className={styles["resolution-categories-icon"]} id={resolutionIcons[group.resolution]} />
      <span className={styles["resolution-categories-content"]}>
        <Text className={styles["resolution-categories-name"]} tag="span" size="m" bold>
          {title}
        </Text>
        {group.issue?.type && (
          <Text tag="span" size="s" className={styles["resolution-categories-type"]}>
            {group.issue.type}
          </Text>
        )}
        {subtitle && (
          <Text tag="span" size="s" className={styles["resolution-categories-comment"]}>
            {subtitle}
          </Text>
        )}
      </span>
    </>
  );

  return (
    <li className={styles["resolution-categories-item"]}>
      {hasTests ? (
        <button
          className={clsx(
            styles["resolution-categories-header"],
            compact && styles["resolution-categories-header-compact"],
            styles["resolution-categories-header-clickable"],
          )}
          onClick={toggle}
          type="button"
        >
          {headerContent}
        </button>
      ) : (
        <div
          className={clsx(
            styles["resolution-categories-header"],
            compact && styles["resolution-categories-header-compact"],
          )}
        >
          {headerContent}
        </div>
      )}
      {hasTests && isOpened && (
        <ul className={styles["resolution-categories-tests"]}>
          {group.testResults.map((testResult, index) => (
            <ResolutionCategoriesTestResult testResult={testResult} index={index} key={testResult.nodeId} />
          ))}
        </ul>
      )}
    </li>
  );
};

const ResolutionCategoriesTestResult: FunctionalComponent<{
  testResult: ReportResolutionTestResult;
  index: number;
}> = ({ testResult, index }) => {
  const { t: tTransitions } = useI18n("transitions");
  const tooltips = {
    transition:
      testResult.tooltips?.transition ??
      (testResult.transition ? tTransitions(`description.${testResult.transition}`) : undefined),
    flaky: testResult.tooltips?.flaky ?? (testResult.flaky ? tTransitions("description.flaky") : undefined),
    retries:
      testResult.tooltips?.retries ??
      (testResult.retriesCount ? tTransitions("description.retries", { count: testResult.retriesCount }) : undefined),
    resolution: testResult.resolution ? tTransitions(`description.resolution.${testResult.resolution}`) : undefined,
  };

  return (
    <li>
      <TreeItem
        id={testResult.nodeId}
        name={testResult.name}
        status={testResult.status}
        duration={testResult.duration}
        flaky={testResult.flaky}
        transition={testResult.transition}
        retriesCount={testResult.retriesCount}
        resolution={testResult.resolution}
        groupOrder={testResult.groupOrder ?? index + 1}
        navigateTo={() => navigateToTestResult({ testResultId: testResult.nodeId })}
        tooltips={tooltips}
      />
    </li>
  );
};

import { type ResolutionCategory } from "@allurereport/core-api";
import { ArrowButton, SvgIcon, Text, TreeItem, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeResolutionGroup, AwesomeResolutionTestResult } from "types";

import { useI18n } from "@/stores/locale";
import { navigateToTestResult } from "@/stores/router";

import * as styles from "./styles.scss";

export type ResolutionCategoriesListProps = {
  groups: AwesomeResolutionGroup[];
  showTests?: boolean;
  emptyText: string;
};

const resolutionIcons: Record<ResolutionCategory, string> = {
  issue: allureIcons.lineDevBug2,
  muted: allureIcons.lineGeneralEye,
  accepted: allureIcons.lineGeneralCheckCircle,
};

const getResolutionTitle = (
  group: AwesomeResolutionGroup,
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
}) => {
  if (!groups.length) {
    return <div className={styles["resolution-categories-empty"]}>{emptyText}</div>;
  }

  return (
    <ul className={styles["resolution-categories-list"]}>
      {groups.map((group) => (
        <ResolutionCategoriesItem group={group} key={group.id} showTests={showTests} />
      ))}
    </ul>
  );
};

const ResolutionCategoriesItem: FunctionalComponent<{
  group: AwesomeResolutionGroup;
  showTests: boolean;
}> = ({ group, showTests }) => {
  const hasTests = showTests && Boolean(group.testResults.length);
  const [isOpened, setIsOpened] = useState(true);
  const { t } = useI18n("filters");
  const title = getResolutionTitle(group, t);
  const subtitle = group.comment ?? group.issue?.comment;
  const toggle = () => setIsOpened((value) => !value);

  return (
    <li className={styles["resolution-categories-item"]}>
      <div className={styles["resolution-categories-header"]}>
        {hasTests ? (
          <ArrowButton
            buttonSize="s"
            className={styles["resolution-categories-arrow"]}
            isOpened={isOpened}
            onClick={toggle}
          />
        ) : (
          <span className={styles["resolution-categories-arrow-spacer"]} />
        )}
        <SvgIcon className={styles["resolution-categories-icon"]} id={resolutionIcons[group.resolution]} />
        <div className={styles["resolution-categories-content"]}>
          {hasTests ? (
            <button className={styles["resolution-categories-title"]} onClick={toggle} type="button">
              <Text className={styles["resolution-categories-name"]} tag="span" size="m" bold>
                {title}
              </Text>
            </button>
          ) : (
            <Text className={styles["resolution-categories-name"]} tag="span" size="m" bold>
              {title}
            </Text>
          )}
          {group.issue?.type && (
            <Text tag="div" size="s" className={styles["resolution-categories-type"]}>
              {group.issue.type}
            </Text>
          )}
          {subtitle && (
            <Text tag="div" size="s" className={styles["resolution-categories-comment"]}>
              {subtitle}
            </Text>
          )}
        </div>
      </div>
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
  testResult: AwesomeResolutionTestResult;
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

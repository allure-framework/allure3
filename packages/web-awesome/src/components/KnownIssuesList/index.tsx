import { ArrowButton, Text, SvgIcon, TreeItem, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeKnownIssue, AwesomeKnownIssueTestResult } from "types";

import { TrLink } from "@/components/TestResult/TrLinks";
import { useI18n } from "@/stores/locale";
import { navigateToTestResult } from "@/stores/router";

import * as styles from "./styles.scss";

export type KnownIssuesListProps = {
  issues: AwesomeKnownIssue[];
  testResultsByIssueId?: Record<string, AwesomeKnownIssueTestResult[]>;
  showTests?: boolean;
  emptyText: string;
};

export const KnownIssuesList: FunctionalComponent<KnownIssuesListProps> = ({
  issues,
  testResultsByIssueId = {},
  showTests = false,
  emptyText,
}) => {
  if (!issues.length) {
    return <div className={styles["known-issues-empty"]}>{emptyText}</div>;
  }

  return (
    <ul className={styles["known-issues-list"]}>
      {issues.map((issue) => {
        const testResults = testResultsByIssueId[issue.id] ?? [];

        return <KnownIssuesItem issue={issue} key={issue.id} showTests={showTests} testResults={testResults} />;
      })}
    </ul>
  );
};

const KnownIssuesItem: FunctionalComponent<{
  issue: AwesomeKnownIssue;
  showTests: boolean;
  testResults: AwesomeKnownIssueTestResult[];
}> = ({ issue, showTests, testResults }) => {
  const hasTests = showTests && Boolean(testResults.length);
  const [isOpened, setIsOpened] = useState(true);
  const { t: tTransitions } = useI18n("transitions");
  const toggle = () => setIsOpened((value) => !value);

  return (
    <li className={styles["known-issues-item"]}>
      <div className={styles["known-issues-header"]}>
        {hasTests ? (
          <ArrowButton buttonSize="s" className={styles["known-issues-arrow"]} isOpened={isOpened} onClick={toggle} />
        ) : (
          <span className={styles["known-issues-arrow-spacer"]} />
        )}
        <SvgIcon className={styles["known-issues-icon"]} id={allureIcons.lineKnownIssues} />
        <div className={styles["known-issues-content"]}>
          {hasTests ? (
            <button className={styles["known-issues-title"]} onClick={toggle} type="button">
              <Text className={styles["known-issues-reason"]} tag="span" size="m" bold>
                {issue.reason}
              </Text>
            </button>
          ) : (
            <Text className={styles["known-issues-reason"]} tag="span" size="m" bold>
              {issue.reason}
            </Text>
          )}
          {Boolean(issue.links?.length) && (
            <div className={styles["known-issues-links"]}>
              {issue.links?.map((link) => (
                <TrLink key={`${link.type ?? ""}:${link.url}`} link={link} />
              ))}
            </div>
          )}
        </div>
      </div>
      {hasTests && isOpened && (
        <ul className={styles["known-issues-tests"]}>
          {testResults.map((testResult, index) => {
            const tooltips = {
              transition:
                testResult.tooltips?.transition ??
                (testResult.transition ? tTransitions(`description.${testResult.transition}`) : undefined),
              flaky: testResult.tooltips?.flaky ?? (testResult.flaky ? tTransitions("description.flaky") : undefined),
              known: testResult.tooltips?.known ?? (testResult.known ? tTransitions("description.known") : undefined),
              retries:
                testResult.tooltips?.retries ??
                (testResult.retriesCount
                  ? tTransitions("description.retries", { count: testResult.retriesCount })
                  : undefined),
            };

            return (
              <li key={testResult.id}>
                <TreeItem
                  {...testResult}
                  id={`${issue.id}-${testResult.id}`}
                  groupOrder={testResult.groupOrder ?? index + 1}
                  navigateTo={() => navigateToTestResult({ testResultId: testResult.id })}
                  tooltips={tooltips}
                />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
};

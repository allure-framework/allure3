import { sanitizeExternalUrl } from "@allurereport/core-api";
import { ArrowButton, Text, SvgIcon, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeKnownIssue, AwesomeKnownIssueTestResult } from "types";

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
              {issue.links?.map((link) => {
                const safeUrl = sanitizeExternalUrl(link.url);
                const label = link.name ?? link.url;

                return safeUrl ? (
                  <Text
                    key={`${link.type ?? ""}:${link.url}`}
                    className={styles["known-issues-link"]}
                    href={safeUrl}
                    rel="noopener noreferrer"
                    tag="a"
                    target="_blank"
                  >
                    {label}
                  </Text>
                ) : (
                  <Text key={`${link.type ?? ""}:${link.url}`} className={styles["known-issues-link"]} tag="span">
                    {label}
                  </Text>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {hasTests && isOpened && (
        <ul className={styles["known-issues-tests"]}>
          {testResults.map((testResult) => (
            <li key={testResult.id}>
              <button
                className={styles["known-issues-test"]}
                onClick={() => navigateToTestResult({ testResultId: testResult.id })}
                type="button"
              >
                <TreeItemIcon className={styles["known-issues-test-status"]} status={testResult.status} />
                <span className={styles["known-issues-test-name"]}>{testResult.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

import { Loadable, PageLoader } from "@allurereport/web-components";

import { KnownIssuesList } from "@/components/KnownIssuesList";
import { useI18n } from "@/stores";
import { knownIssuesStore } from "@/stores/knownIssues";

import * as styles from "./styles.scss";

export const ReportKnownIssues = () => {
  const { t } = useI18n("empty");

  return (
    <Loadable
      source={knownIssuesStore}
      renderLoader={() => (
        <div className={styles["report-known-issues-loader"]}>
          <PageLoader />
        </div>
      )}
      renderData={(knownIssues) => (
        <KnownIssuesList
          issues={knownIssues?.issues ?? []}
          testResultsByIssueId={knownIssues?.testResultsByIssueId}
          showTests
          emptyText={t("no-known-issues-results")}
        />
      )}
    />
  );
};

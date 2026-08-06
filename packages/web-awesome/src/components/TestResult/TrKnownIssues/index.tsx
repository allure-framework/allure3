import type { FunctionalComponent } from "preact";

import { KnownIssuesList } from "@/components/KnownIssuesList";
import type { TrViewProps } from "@/components/TestResult";
import { useI18n } from "@/stores";

export const TrKnownIssuesView: FunctionalComponent<TrViewProps> = ({ testResult }) => {
  const { t } = useI18n("empty");
  const issues = testResult?.knownIssues ?? [];

  return <KnownIssuesList issues={issues} emptyText={t("no-known-issues-results")} />;
};

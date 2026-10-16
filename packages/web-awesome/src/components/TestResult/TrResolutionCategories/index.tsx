import type { FunctionalComponent } from "preact";
import type { ReportResolutionGroup } from "types";

import { ResolutionCategoriesList } from "@/components/ResolutionCategoriesList";
import type { TrViewProps } from "@/components/TestResult";
import { useI18n } from "@/stores";

export const TrResolutionCategoriesView: FunctionalComponent<TrViewProps> = ({ testResult }) => {
  const { t } = useI18n("empty");
  const groups: ReportResolutionGroup[] = testResult?.resolution
    ? [
        {
          id: [
            testResult.resolution,
            testResult.resolutionIssue?.id ?? testResult.id,
            testResult.resolution === "muted" ? (testResult.resolutionExpiresAt ?? "forever") : undefined,
          ]
            .filter(Boolean)
            .join(":"),
          resolution: testResult.resolution,
          name: testResult.resolutionIssue?.id ?? testResult.resolution,
          comment: testResult.resolutionComment ?? testResult.resolutionIssue?.comment,
          expiresAt: testResult.resolutionExpiresAt,
          resolutionState: testResult.resolutionState,
          issue: testResult.resolutionIssue,
          testResults: [],
        },
      ]
    : [];

  return <ResolutionCategoriesList groups={groups} emptyText={t("no-resolution-categories-results")} compact />;
};

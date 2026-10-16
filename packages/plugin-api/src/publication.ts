/** Final publication outcome for an enabled plugin with publish: true. */
export type ReportPublication =
  | { pluginId: string; status: "published" }
  | {
      pluginId: string;
      status: "not-published";
      reason: "generation-failed" | "no-report-files" | "publisher-unavailable" | "publication-failed";
    };

export const PUBLICATION_FILENAME = "publication.json";

export const PUBLICATION_FAILURE_MESSAGES: Record<
  Extract<ReportPublication, { status: "not-published" }>["reason"],
  string
> = {
  "generation-failed": "Report generation failed",
  "no-report-files": "No report files were generated",
  "publisher-unavailable": "Publication client is unavailable; check the Allure service access token",
  "publication-failed": "The remote publication operation failed",
};

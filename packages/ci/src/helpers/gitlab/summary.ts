import type { ReportContext, ReportContextTestReport } from "../../reportContext.js";
import { renderReportSummaryMarkdown } from "../../reportMarkdown.js";

const reportHref = (report: ReportContextTestReport, reportUrl: URL): string | undefined => {
  const { href, reportPath } = report;

  if (href && /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)) {
    return href;
  }

  if (reportPath !== undefined) {
    // summary.json moves with flattened reports; its directory is the final local report location.
    const path = reportPath.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return new URL(`${path ? `${path}/` : ""}index.html`, reportUrl).href;
  }

  return href ? new URL(href, reportUrl).href : undefined;
};

export const renderGitlabReportSummary = (summary: ReportContext, reportUrl: URL): string => {
  const context: ReportContext = {
    ...summary,
    reports: summary.reports.map((report) => ({ ...report, href: reportHref(report, reportUrl) })),
  };

  return renderReportSummaryMarkdown(context, { includeArtifacts: false });
};

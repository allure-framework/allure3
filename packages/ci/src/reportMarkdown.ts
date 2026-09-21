import type { TestStatus } from "@allurereport/core-api";

import type {
  ReportContext,
  ReportContextArtifact,
  ReportContextFlagStats,
  ReportContextTestReport,
  ReportContextResolutionStats,
  ReportContextStatusStats,
} from "./reportContext.js";

const STATUS_ORDER = ["passed", "failed", "broken", "skipped", "unknown"] as const satisfies TestStatus[];

const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
  passed: "Passed tests",
  failed: "Failed tests",
  broken: "Broken tests",
  skipped: "Skipped tests",
  unknown: "Unknown tests",
};

const STATUS_ICON_BASE_URL = "https://allurecharts.qameta.workers.dev/dot";
const STATUS_PIE_BASE_URL = "https://allurecharts.qameta.workers.dev/pie";

export type ReportSummaryMarkdownRow = {
  kind: "total" | "environment" | "report";
  name: string;
  duration: number;
  stats: ReportContextStatusStats;
  flags: ReportContextFlagStats;
  resolutions?: ReportContextResolutionStats;
  report?: ReportContextTestReport;
};

type ReportLink = {
  label: string;
  href: string;
  kind: "report" | "testops";
};

export type RenderReportSummaryMarkdownOptions = {
  title?: string;
  includeArtifacts?: boolean;
  getReportFilterHref?: (filter: keyof ReportContextFlagStats, row: ReportSummaryMarkdownRow) => string | undefined;
};

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const tableCell = (value: string | number): string =>
  escapeHtml(String(value)).replaceAll("|", "&#124;").replaceAll("\n", "<br>");

const isSafeHref = (href: string): boolean => {
  try {
    const url = new URL(href);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(href);
  }
};

const link = (label: string, href: string): string =>
  isSafeHref(href) ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : escapeHtml(label);

const statusIcon = (status: (typeof STATUS_ORDER)[number]): string =>
  `<img alt="${STATUS_LABELS[status]}" src="${STATUS_ICON_BASE_URL}?type=${status}&size=8" width="8" height="8" />`;

const statusPie = (stats: ReportContextStatusStats): string => {
  const total = STATUS_ORDER.reduce((sum, status) => sum + (stats[status] ?? 0), 0);

  if (total === 0) {
    return "";
  }

  const params = new URLSearchParams({
    passed: String(stats.passed ?? 0),
    failed: String(stats.failed ?? 0),
    broken: String(stats.broken ?? 0),
    skipped: String(stats.skipped ?? 0),
    unknown: String(stats.unknown ?? 0),
    size: "32",
  });

  return `<img src="${STATUS_PIE_BASE_URL}?${params.toString()}" width="28px" height="28px" />&nbsp;&nbsp;&nbsp;&nbsp;`;
};

const formatDuration = (duration: number): string => {
  if (!Number.isFinite(duration) || duration <= 0) {
    return "0ms";
  }

  if (duration < 1000) {
    return `${Math.round(duration)}ms`;
  }

  const totalSeconds = Math.round(duration / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const parts: string[] = [];

  if (hours) {
    parts.push(`${hours}h`);
  }

  if (minutes) {
    parts.push(`${minutes}m`);
  }

  if (seconds || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
};

const formatStats = (stats: ReportContextStatusStats): string => {
  const lines: string[] = [];

  STATUS_ORDER.forEach((status) => {
    const count = stats[status] ?? 0;

    if (count > 0) {
      lines.push(`${statusIcon(status)}&#8288;&nbsp;${count}`);
    }
  });

  return lines.length ? lines.join("<br>") : "0";
};

const formatResolutions = (resolutions?: ReportContextResolutionStats): string => {
  if (!resolutions) {
    return "";
  }

  const lines = [
    resolutions.issues ? `Issues: ${resolutions.issues}` : "",
    resolutions.muted ? `Muted: ${resolutions.muted}` : "",
    resolutions.accepted ? `Accepted: ${resolutions.accepted}` : "",
  ].filter(Boolean);

  return lines.join("<br>");
};

const hasResolutions = (resolutions: ReportContextResolutionStats): boolean =>
  resolutions.issues > 0 || resolutions.muted > 0 || resolutions.accepted > 0;

const formatFlag = (
  flag: keyof ReportContextFlagStats,
  row: ReportSummaryMarkdownRow,
  options: RenderReportSummaryMarkdownOptions,
): string => {
  const value = row.flags[flag];

  if (value <= 0) {
    return "0";
  }

  const label = String(value);
  const href = options.getReportFilterHref?.(flag, row);

  return href ? link(label, href) : label;
};

const renderTable = (
  rows: ReportSummaryMarkdownRow[],
  includeResolutions: boolean,
  options: RenderReportSummaryMarkdownOptions,
): string => {
  const headers = [
    "&nbsp;&nbsp;&nbsp;&nbsp;",
    "Scope",
    "Duration",
    "Stats",
    ...(includeResolutions ? ["Resolutions"] : []),
    "New",
    "Flaky",
    "Retry",
  ];
  const divider = headers.map(() => "---");
  const body = rows.map((row) =>
    [
      statusPie(row.stats),
      tableCell(row.name),
      tableCell(formatDuration(row.duration)),
      formatStats(row.stats),
      ...(includeResolutions ? [formatResolutions(row.resolutions)] : []),
      formatFlag("new", row, options),
      formatFlag("flaky", row, options),
      formatFlag("retry", row, options),
    ].join(" | "),
  );

  return [`| ${headers.join(" | ")} |`, `| ${divider.join(" | ")} |`, ...body.map((row) => `| ${row} |`)].join("\n");
};

const reportHref = (report: ReportContextTestReport): string | undefined => report.remoteHref ?? report.href;

const reportLabel = (report: ReportContextTestReport): string => report.plugin ?? report.name;

const reportLinkKind = (report: ReportContextTestReport): ReportLink["kind"] =>
  report.plugin?.toLowerCase() === "testops" ? "testops" : "report";

const toReportLink = (report: ReportContextTestReport): ReportLink | undefined => {
  const href = reportHref(report);

  return href
    ? {
        label: reportLabel(report),
        href,
        kind: reportLinkKind(report),
      }
    : undefined;
};

const sortLinks = (links: ReportLink[]): ReportLink[] =>
  links.toSorted((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label));

const renderLinks = (label: string, links: ReportLink[]): string | undefined => {
  if (!links.length) {
    return undefined;
  }

  return `**${escapeHtml(label)}:** ${links.map((item) => link(item.label, item.href)).join(", ")}`;
};

const renderReportLinks = (reports: ReportContextTestReport[]): string[] => {
  const links = sortLinks(reports.map(toReportLink).filter((item): item is ReportLink => item !== undefined));
  const reportLinks = links.filter(({ kind }) => kind === "report");
  const testOpsLinks = links.filter(({ kind }) => kind === "testops");

  return [renderLinks("Reports", reportLinks), renderLinks("TestOps", testOpsLinks)].filter(
    (line): line is string => line !== undefined,
  );
};

const pluginSummaryToStatusStats = (report: ReportContextTestReport): ReportContextStatusStats => ({
  failed: report.stats.failed ?? 0,
  broken: report.stats.broken ?? 0,
  passed: report.stats.passed ?? 0,
  skipped: report.stats.skipped ?? 0,
  unknown: report.stats.unknown ?? 0,
  total: report.stats.total ?? 0,
});

const pluginSummaryToFlags = (report: ReportContextTestReport): ReportContextFlagStats => ({
  new: report.newTests?.length ?? report.stats.new ?? 0,
  flaky: report.flakyTests?.length ?? report.stats.flaky ?? 0,
  retry: report.retryTests?.length ?? report.stats.retries ?? 0,
});

const pluginSummaryToResolutions = (report: ReportContextTestReport): ReportContextResolutionStats => ({
  issues: report.stats.resolutions?.issues ?? 0,
  muted: report.stats.resolutions?.muted ?? 0,
  accepted: report.stats.resolutions?.accepted ?? 0,
});

const renderFilteredReports = (
  reports: ReportContextTestReport[],
  options: RenderReportSummaryMarkdownOptions,
): string | undefined => {
  const rows = reports.map((report) => ({
    kind: "report" as const,
    name: report.name,
    duration: report.duration,
    stats: pluginSummaryToStatusStats(report),
    flags: pluginSummaryToFlags(report),
    resolutions: pluginSummaryToResolutions(report),
    report,
  }));

  if (!rows.length) {
    return undefined;
  }

  const includeResolutions = rows.some(({ resolutions }) => resolutions && hasResolutions(resolutions));
  const links = renderReportLinks(reports);

  return ["**Filtered Reports**", renderTable(rows, includeResolutions, options), ...links].join("\n\n");
};

const renderArtifacts = (artifacts: ReportContextArtifact[]): string | undefined => {
  if (!artifacts.length) {
    return undefined;
  }

  const rows = artifacts.map(({ name, path }) => `| ${tableCell(name)} | ${tableCell(path)} |`);

  return [
    `<details>`,
    `<summary>Artifacts used (${artifacts.length})</summary>`,
    "",
    "| Name | Path |",
    "| --- | --- |",
    ...rows,
    "",
    "</details>",
  ].join("\n");
};

export const renderReportSummaryMarkdown = (
  context: ReportContext,
  options: RenderReportSummaryMarkdownOptions = {},
): string => {
  const { title = "Allure Report Summary", includeArtifacts = true } = options;
  const regularReports = context.reports.filter((report) => report.filtered !== true);
  const filteredReports = context.reports.filter((report) => report.filtered === true);
  const aggregateRows: ReportSummaryMarkdownRow[] = [
    {
      kind: "total",
      name: "All tests",
      duration: context.totals.duration,
      stats: context.totals.stats,
      flags: context.totals.flags,
      resolutions: context.totals.resolutions,
    },
    ...context.environments.map((environment) => ({
      kind: "environment" as const,
      name: environment.name,
      duration: environment.duration,
      stats: environment.stats,
      flags: environment.flags,
    })),
  ];
  const includeResolutions = hasResolutions(context.totals.resolutions);
  const sections = [
    `# ${escapeHtml(title)}`,
    renderTable(aggregateRows, includeResolutions, options),
    ...renderReportLinks(regularReports),
    renderFilteredReports(filteredReports, options),
    includeArtifacts ? renderArtifacts(context.artifacts) : undefined,
  ].filter((section): section is string => Boolean(section));

  return `${sections.join("\n\n")}\n`;
};

import { type CiDescriptor, GitProvider } from "@allurereport/core-api";
import type { PluginSummary } from "@allurereport/plugin-api";

export type ContextLink = { label: string; href: string };

const browserUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }

    if (url.username || url.password) {
      url.username = "";
      url.password = "";

      return url.toString();
    }

    return value;
  } catch {
    return undefined;
  }
};

const trimTrailingSlashes = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  let end = value.length;

  while (end > 0 && value[end - 1] === "/") {
    end--;
  }

  return value.slice(0, end);
};

const commitUrl = (ci: CiDescriptor, sha: string): string | undefined => {
  const explicit = browserUrl(ci.commitUrl);

  if (explicit) {
    return explicit;
  }

  const repositoryUrl = trimTrailingSlashes(browserUrl(ci.repository?.url))?.replace(/\.git$/i, "");
  const pullRequestUrl = trimTrailingSlashes(browserUrl(ci.pullRequest?.url));

  switch (ci.provider) {
    case GitProvider.Github:
      if (!pullRequestUrl && !repositoryUrl) return undefined;

      if (pullRequestUrl) {
        return `${pullRequestUrl}/commits/${encodeURIComponent(sha)}`;
      } else {
        return `${repositoryUrl}/commit/${encodeURIComponent(sha)}`;
      }
    case GitProvider.Gitlab:
      if (!pullRequestUrl && !repositoryUrl) return undefined;

      if (pullRequestUrl) {
        return `${pullRequestUrl}/diffs?commit_id=${encodeURIComponent(sha)}`;
      } else {
        return `${repositoryUrl}/-/commit/${encodeURIComponent(sha)}`;
      }
    case GitProvider.Bitbucket:
      return repositoryUrl ? `${repositoryUrl}/commits/${encodeURIComponent(sha)}` : undefined;
    default:
      return undefined;
  }
};

type ReportCiContext = Pick<PluginSummary, "commitSha" | "commitHref" | "ciRunName" | "ciRunHref">;

export const createReportCiContext = (ci: CiDescriptor | undefined): ReportCiContext => {
  if (!ci) {
    return { commitSha: undefined, commitHref: undefined, ciRunName: undefined, ciRunHref: undefined };
  }

  const sha = ci.commitSha;
  const pipelineHref = browserUrl(ci.pipelineRunUrl);
  const runHref = pipelineHref || browserUrl(ci.jobRunUrl);

  return {
    commitSha: sha,
    commitHref: sha ? commitUrl(ci, sha) : undefined,
    ciRunHref: runHref,
    ciRunName: runHref
      ? pipelineHref
        ? ci.pipelineRunName || "Pipeline"
        : ci.jobRunName || ci.jobRunUid || ci.type
      : undefined,
  };
};

export const reportCiContextLinks = (report: ReportCiContext): ContextLink[] => {
  const links: ContextLink[] = [];
  const sha = report.commitSha;
  const shaUrl = browserUrl(report.commitHref);
  const runUrl = browserUrl(report.ciRunHref);

  if (sha && shaUrl) {
    links.push({ label: sha.slice(0, 8), href: shaUrl });
  }

  if (runUrl) {
    links.push({ label: report.ciRunName || "CI run", href: runUrl });
  }

  return links;
};

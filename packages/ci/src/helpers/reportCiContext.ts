import { type CiDescriptor, GitProvider } from "@allurereport/core-api";

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
      return pullRequestUrl
        ? `${pullRequestUrl}/commits/${encodeURIComponent(sha)}`
        : repositoryUrl
          ? `${repositoryUrl}/commit/${encodeURIComponent(sha)}`
          : undefined;
    case GitProvider.Gitlab:
      return pullRequestUrl
        ? `${pullRequestUrl}/diffs?commit_id=${encodeURIComponent(sha)}`
        : repositoryUrl
          ? `${repositoryUrl}/-/commit/${encodeURIComponent(sha)}`
          : undefined;
    case GitProvider.Bitbucket:
      return repositoryUrl ? `${repositoryUrl}/commits/${encodeURIComponent(sha)}` : undefined;
    default:
      return undefined;
  }
};

export const reportCiContextLinks = (ci: CiDescriptor | undefined): ContextLink[] => {
  if (!ci) {
    return [];
  }

  const links: ContextLink[] = [];
  const sha = ci.commitSha;
  const shaUrl = sha ? commitUrl(ci, sha) : undefined;
  const runUrl = browserUrl(ci.jobRunUrl);

  if (sha && shaUrl) {
    links.push({ label: sha.slice(0, 8), href: shaUrl });
  }

  if (runUrl) {
    links.push({ label: ci.jobRunName || ci.jobRunUid || ci.type, href: runUrl });
  }

  return links;
};

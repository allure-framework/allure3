import { GitProvider } from "@allurereport/core-api";

const stripGitSuffix = (url: string): string => url.replace(/\.git\/?$/i, "");

/** Strips `refs/heads/` from Azure/Git ref strings. */
export const stripRefsHeads = (ref: string): string => ref.replace(/^refs\/heads\//, "");

/** Extracts PR number from GitHub/GitLab/Bitbucket pull-request URLs (e.g. CircleCI `CIRCLE_PULL_REQUEST`). */
export const parsePullRequestNumberFromUrl = (pullRequestUrl: string): string | undefined => {
  const trimmed = pullRequestUrl.trim();

  if (!trimmed) {
    return undefined;
  }

  const match =
    trimmed.match(/\/pull\/(\d+)\/?$/i) ??
    trimmed.match(/\/merge_requests\/(\d+)\/?$/i) ??
    trimmed.match(/\/pull-requests\/(\d+)\/?$/i);

  return match?.[1];
};

export const hostMatchesProvider = (host: string, provider: GitProvider): boolean => {
  const normalizedHost = host.toLowerCase();

  switch (provider) {
    case GitProvider.Github:
      return (
        normalizedHost === "github.com" ||
        normalizedHost.endsWith(".github.com") ||
        normalizedHost.startsWith("github.")
      );
    case GitProvider.Gitlab:
      return (
        normalizedHost === "gitlab.com" ||
        normalizedHost.endsWith(".gitlab.com") ||
        normalizedHost.startsWith("gitlab.")
      );
    case GitProvider.Bitbucket:
      return (
        normalizedHost === "bitbucket.org" ||
        normalizedHost.endsWith(".bitbucket.org") ||
        normalizedHost.startsWith("bitbucket.")
      );
    default:
      return false;
  }
};

/** Normalizes https and scp-style remotes into an https URL suitable for parsing. */
export const normalizeGitRemoteUrl = (remote: string): string | undefined => {
  const trimmed = remote.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("ssh://")) {
    try {
      const parsed = new URL(trimmed);

      return `https://${parsed.hostname}${parsed.pathname}`;
    } catch {
      return undefined;
    }
  }

  const scpMatch = /^[^@]+@([^:]+):(.+)$/.exec(trimmed);

  if (scpMatch) {
    return `https://${scpMatch[1]}/${scpMatch[2].replace(/^\//, "")}`;
  }

  return undefined;
};

export const inferGitProviderFromUrl = (remote: string): GitProvider | undefined => {
  const normalized = normalizeGitRemoteUrl(remote);

  if (!normalized) {
    return undefined;
  }

  try {
    const host = new URL(normalized).hostname.toLowerCase();

    for (const provider of [GitProvider.Github, GitProvider.Gitlab, GitProvider.Bitbucket] as const) {
      if (hostMatchesProvider(host, provider)) {
        return provider;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export const parseRepositorySlugFromUrl = (remote: string, provider: GitProvider): string | undefined => {
  const normalized = normalizeGitRemoteUrl(remote);

  if (!normalized) {
    return undefined;
  }

  try {
    const pathname = new URL(normalized).pathname.replace(/^\/+/, "").replace(/\.git\/?$/i, "");

    if (!pathname) {
      return undefined;
    }

    const segments = pathname.split("/").filter(Boolean);

    if (provider === GitProvider.Github || provider === GitProvider.Bitbucket) {
      if (segments.length < 2) {
        return undefined;
      }

      return `${segments[0]}/${segments[1]}`;
    }

    return pathname;
  } catch {
    return undefined;
  }
};

export type ResolvedGitRepository = {
  provider: GitProvider;
  slug: string;
  url: string;
};

export const resolveRepositoryFromGitUrl = (remote: string): ResolvedGitRepository | undefined => {
  const provider = inferGitProviderFromUrl(remote);

  if (!provider) {
    return undefined;
  }

  const slug = parseRepositorySlugFromUrl(remote, provider);

  if (!slug) {
    return undefined;
  }

  const normalized = normalizeGitRemoteUrl(remote);

  if (!normalized) {
    return undefined;
  }

  return {
    provider,
    slug,
    url: stripGitSuffix(normalized),
  };
};

import { gitlab, type GitlabCiDescriptor } from "../../detectors/gitlab.js";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ARTIFACT_REDIRECTS = 5;

export type GitlabClient = {
  // ci is the typed non-secret GitLab detector; no token property.
  ci: GitlabCiDescriptor;
  query<T>(query: string, variables: Record<string, unknown>): Promise<T>;
  requestJson<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<{ data: T; headers: Headers }>;
  downloadArtifact(jobId: string, artifactPath: string): Promise<Uint8Array>;
};

type GraphqlEnvelope<T> = {
  data?: T;
  errors?: unknown;
};

const isDecimalString = (value: string): boolean => /^[0-9]+$/.test(value);

const requireMetadata = (ci: GitlabCiDescriptor): string[] => {
  const missing: string[] = [];

  if (!ci.detected) {
    missing.push("GitLab CI");
  }

  if (!ci.projectId) {
    missing.push("CI_PROJECT_ID");
  }

  if (!ci.projectPath) {
    missing.push("CI_PROJECT_PATH");
  }

  if (!ci.projectDirectory) {
    missing.push("CI_PROJECT_DIR");
  }

  if (!ci.jobRunUid) {
    missing.push("CI_PIPELINE_ID");
  }

  if (!ci.pipelineSource) {
    missing.push("CI_PIPELINE_SOURCE");
  }

  if (!ci.ciJobName) {
    missing.push("CI_JOB_NAME");
  }

  if (!ci.ref) {
    missing.push("CI_COMMIT_REF_NAME");
  }

  return missing;
};

const invalidNumericMetadata = (ci: GitlabCiDescriptor): string[] => {
  const invalid: string[] = [];

  if (!isDecimalString(ci.projectId)) {
    invalid.push("CI_PROJECT_ID");
  }

  if (!isDecimalString(ci.jobRunUid)) {
    invalid.push("CI_PIPELINE_ID");
  }

  if (ci.currentJobId && !isDecimalString(ci.currentJobId)) {
    invalid.push("CI_JOB_ID");
  }

  if (ci.mergeRequestProjectId && !isDecimalString(ci.mergeRequestProjectId)) {
    invalid.push("CI_MERGE_REQUEST_PROJECT_ID");
  }

  return invalid;
};

const bodyCancel = (response: Response) => {
  void response.body?.cancel().catch(() => undefined);
};

const requestWithTimeout = async <T>(
  url: URL,
  init: RequestInit,
  consume: (response: Response) => Promise<T>,
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "manual",
  });

  return consume(response);
};

const isRedirect = (response: Response): boolean => response.status >= 300 && response.status < 400;

const encodeArtifactPathSegment = (segment: string): string => {
  if (segment === ".") {
    return "%2E";
  }

  if (segment === "..") {
    return "%2E%2E";
  }

  return encodeURIComponent(segment);
};

const encodeArtifactPath = (artifactPath: string): string =>
  artifactPath.split("/").map(encodeArtifactPathSegment).join("/");

const buildRestUrl = (restApiUrl: URL, path: string): URL =>
  new URL(path.replace(/^\/+/, ""), `${restApiUrl.href.replace(/\/+$/, "")}/`);

const hasApiPathSuffix = (url: URL, suffix: string): boolean => url.pathname.replace(/\/+$/, "").endsWith(suffix);

const assertTrustedApiUrl = (url: URL, apiOrigin: string) => {
  if (url.origin !== apiOrigin) {
    throw new Error("GitLab API request left trusted origin");
  }
};

export const createGitlabClient = (options?: { token?: string }): GitlabClient => {
  const token = options?.token;
  const ci = gitlab;
  const missingMetadata = requireMetadata(ci);

  if (missingMetadata.length > 0) {
    throw new Error(`missing GitLab metadata: ${missingMetadata.join(", ")}`);
  }

  const invalidNumeric = invalidNumericMetadata(ci);

  if (invalidNumeric.length > 0) {
    throw new Error(`invalid numeric GitLab metadata: ${invalidNumeric.join(", ")}`);
  }

  const restApiUrl = new URL(ci.restApiUrl);
  const graphqlApiUrl = new URL(ci.graphqlApiUrl);

  if (!hasApiPathSuffix(restApiUrl, "/api/v4") || !hasApiPathSuffix(graphqlApiUrl, "/api/graphql")) {
    throw new Error("invalid GitLab API endpoint paths");
  }

  if (restApiUrl.origin !== graphqlApiUrl.origin) {
    throw new Error("GitLab API origins do not match");
  }

  const apiOrigin = restApiUrl.origin;
  const authHeaders = (): Record<string, string> => (token ? { "private-token": token } : {});

  return {
    ci,

    async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
      assertTrustedApiUrl(graphqlApiUrl, apiOrigin);
      return requestWithTimeout(
        graphqlApiUrl,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
            "content-type": "application/json",
          },
          body: JSON.stringify({ query, variables }),
        },
        async (response) => {
          if (isRedirect(response)) {
            bodyCancel(response);
            throw new Error("GitLab GraphQL request redirected");
          }

          if (!response.ok) {
            bodyCancel(response);
            throw new Error("GitLab GraphQL request failed");
          }

          const envelope = (await response.json()) as GraphqlEnvelope<T>;

          if (!envelope || typeof envelope !== "object") {
            throw new Error("GitLab GraphQL response was invalid");
          }

          if (envelope.errors) {
            throw new Error("GitLab GraphQL response contained errors");
          }

          if (!Object.hasOwn(envelope, "data")) {
            throw new Error("GitLab GraphQL response omitted data");
          }

          return envelope.data as T;
        },
      );
    },

    async requestJson<T>(
      method: "GET" | "POST" | "PUT",
      path: string,
      body?: unknown,
    ): Promise<{ data: T; headers: Headers }> {
      const url = buildRestUrl(restApiUrl, path);
      assertTrustedApiUrl(url, apiOrigin);
      return requestWithTimeout(
        url,
        {
          method,
          headers: {
            ...authHeaders(),
            ...(body === undefined ? {} : { "content-type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        async (response) => {
          if (isRedirect(response)) {
            bodyCancel(response);
            throw new Error("GitLab API request redirected");
          }

          if (!response.ok) {
            bodyCancel(response);
            throw new Error("GitLab API request failed");
          }

          return {
            data: (await response.json()) as T,
            headers: response.headers,
          };
        },
      );
    },

    async downloadArtifact(jobId: string, artifactPath: string): Promise<Uint8Array> {
      let url = buildRestUrl(
        restApiUrl,
        `/projects/${encodeURIComponent(ci.projectId)}/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeArtifactPath(
          artifactPath,
        )}`,
      );
      let redirects = 0;

      while (true) {
        const sameOrigin = url.origin === apiOrigin;
        const result = await requestWithTimeout(
          url,
          {
            method: "GET",
            headers: sameOrigin ? authHeaders() : {},
          },
          async (response): Promise<{ type: "redirect"; location: string } | { type: "bytes"; bytes: Uint8Array }> => {
            if (isRedirect(response)) {
              const location = response.headers.get("location");
              bodyCancel(response);

              if (!location) {
                throw new Error("GitLab artifact redirect missing location");
              }

              return { type: "redirect", location };
            }

            if (!response.ok) {
              bodyCancel(response);
              throw new Error("GitLab artifact request failed");
            }

            return { type: "bytes", bytes: new Uint8Array(await response.arrayBuffer()) };
          },
        );

        if (result.type === "redirect") {
          if (redirects >= MAX_ARTIFACT_REDIRECTS) {
            throw new Error("GitLab artifact request had too many redirects");
          }

          const redirectUrl = new URL(result.location, url);

          if (url.protocol === "https:" && redirectUrl.protocol === "http:") {
            throw new Error("GitLab artifact redirect downgraded HTTPS");
          }

          url = redirectUrl;
          redirects += 1;
          continue;
        }

        return result.bytes;
      }
    },
  };
};

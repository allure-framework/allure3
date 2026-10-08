import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

import { gitlab, type GitlabCiDescriptor } from "../../detectors/gitlab.js";

const REQUEST_TIMEOUT_MS = 10_000;

export type GitlabClient = {
  // ci is the typed non-secret GitLab detector; no token property.
  ci: GitlabCiDescriptor;
  query<T>(query: string, variables: Record<string, unknown>): Promise<T>;
  requestJson<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
  ): Promise<{ data: T; headers: AxiosResponse["headers"] }>;
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
  const requestOptions: AxiosRequestConfig = {
    headers: token ? { "private-token": token } : {},
    // Artifact downloads may redirect to object storage outside GitLab.
    sensitiveHeaders: ["private-token"],
    timeout: REQUEST_TIMEOUT_MS,
  };

  return {
    ci,

    async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
      const { data: envelope } = await axios.request<GraphqlEnvelope<T>>({
        ...requestOptions,
        url: graphqlApiUrl.href,
        method: "POST",
        data: { query, variables },
      });

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

    async requestJson<T>(
      method: "GET" | "POST" | "PUT",
      path: string,
      body?: unknown,
    ): Promise<{ data: T; headers: AxiosResponse["headers"] }> {
      const url = buildRestUrl(restApiUrl, path);
      assertTrustedApiUrl(url, apiOrigin);
      const { data, headers } = await axios.request<T>({
        ...requestOptions,
        url: url.href,
        method,
        data: body,
      });

      return { data, headers };
    },

    async downloadArtifact(jobId: string, artifactPath: string): Promise<Uint8Array> {
      const url = buildRestUrl(
        restApiUrl,
        `/projects/${encodeURIComponent(ci.projectId)}/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeArtifactPath(
          artifactPath,
        )}`,
      );
      const { data } = await axios.request<Uint8Array>({
        ...requestOptions,
        url: url.href,
        method: "GET",
        responseType: "arraybuffer",
      });

      return data;
    },
  };
};

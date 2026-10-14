import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, sep } from "node:path";

import { getEnv } from "../../utils.js";
import { createGitlabClient, type GitlabClient } from "./client.js";

const previousGitlabJobQuery = `query PreviousGitlabJob($path: ID!, $ref: String!, $source: String, $job: String!) {
  project(fullPath: $path) {
    pipelines(ref: $ref, source: $source, first: 100) {
      nodes { id source job(name: $job) { id name status retried } }
    }
  }
}`;

type GitlabJobCriteria = {
  project: string;
  ref: string;
  source: string | string[];
  job: string;
  beforePipelineId?: bigint;
};

type PreviousGitlabJobResponse = {
  project: {
    pipelines: {
      nodes: GitlabPipelineNode[];
    };
  } | null;
};

type GitlabPipelineNode = {
  id: string;
  source: string;
  job: GitlabJobNode | null;
};

type GitlabJobNode = {
  id: string;
  name: string;
  status: string;
  retried: boolean | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const decodeGitlabId = (value: unknown, type: "Pipeline" | "Build"): { text: string; value: bigint } => {
  if (typeof value !== "string") {
    throw new Error("invalid id");
  }

  const typeName = type === "Pipeline" ? "Pipeline" : "Build";
  const match = value.match(new RegExp(`^gid://gitlab/Ci::${typeName}/([0-9]+)$`));

  if (!match) {
    throw new Error("invalid id");
  }

  return { text: match[1], value: BigInt(match[1]) };
};

const parseJob = (value: unknown): GitlabJobNode | null => {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error("invalid job");
  }

  const { id, name, status, retried } = value;

  if (typeof id !== "string" || typeof name !== "string" || typeof status !== "string") {
    throw new Error("invalid job");
  }

  if (retried !== true && retried !== false && retried !== null) {
    throw new Error("invalid job");
  }

  return { id, name, status, retried };
};

const parsePipelines = (response: unknown): GitlabPipelineNode[] => {
  if (!isRecord(response) || !isRecord(response.project)) {
    throw new Error("invalid project");
  }

  const { pipelines } = response.project;

  if (!isRecord(pipelines) || !Array.isArray(pipelines.nodes)) {
    throw new Error("invalid pipelines");
  }

  return pipelines.nodes.map((node) => {
    if (
      !isRecord(node) ||
      typeof node.id !== "string" ||
      typeof node.source !== "string" ||
      !Object.hasOwn(node, "job")
    ) {
      throw new Error("invalid pipeline");
    }

    return {
      id: node.id,
      source: node.source,
      job: parseJob(node.job),
    };
  });
};

const findLastJobId = async (client: GitlabClient, criteria: GitlabJobCriteria): Promise<string | undefined> => {
  const source = typeof criteria.source === "string" ? criteria.source : null;
  const sources = typeof criteria.source === "string" ? [criteria.source] : criteria.source;
  const response = await client.query<PreviousGitlabJobResponse>(previousGitlabJobQuery, {
    path: criteria.project,
    ref: criteria.ref,
    source,
    job: criteria.job,
  });
  const nodes = parsePipelines(response);
  let previousPipelineId: bigint | undefined;
  let selectedJobId: string | undefined;

  for (const node of nodes) {
    const pipelineId = decodeGitlabId(node.id, "Pipeline");

    if (previousPipelineId !== undefined && pipelineId.value >= previousPipelineId) {
      throw new Error("invalid pipeline order");
    }

    previousPipelineId = pipelineId.value;

    if (source !== null && node.source !== source) {
      throw new Error("invalid pipeline source");
    }

    const { job } = node;
    const jobId = job ? decodeGitlabId(job.id, "Build") : undefined;

    if (
      selectedJobId ||
      (criteria.beforePipelineId !== undefined && pipelineId.value >= criteria.beforePipelineId) ||
      !sources.includes(node.source) ||
      !job ||
      !jobId
    ) {
      continue;
    }

    if (job.name !== criteria.job) {
      continue;
    }

    if (job.status !== "SUCCESS" && job.status !== "FAILED") {
      continue;
    }

    if (job.retried === true) {
      continue;
    }

    selectedJobId = jobId.text;
  }

  return selectedJobId;
};

const projectRelativePath = (projectDirectory: string, historyPath: string): string =>
  relative(projectDirectory, historyPath).split(sep).join("/");

export const restoreGitlabHistory = async (options: { token?: string; historyPath: string }): Promise<void> => {
  const client = createGitlabClient(options);
  const criteria = {
    project: client.ci.projectPath,
    ref: client.ci.ref,
    source: client.ci.pipelineSource,
    job: client.ci.ciJobName,
  };
  let selectedJobId = await findLastJobId(client, {
    ...criteria,
    beforePipelineId: BigInt(client.ci.jobRunUid),
  });

  if (!selectedJobId && client.ci.pipelineSource === "merge_request_event") {
    const targetBranch = client.ci.targetBranch;
    const defaultBranch = getEnv("CI_DEFAULT_BRANCH");

    if (targetBranch && targetBranch !== defaultBranch) {
      selectedJobId = await findLastJobId(client, { ...criteria, ref: targetBranch });
    }

    if (!selectedJobId && defaultBranch) {
      selectedJobId = await findLastJobId(client, { ...criteria, ref: defaultBranch, source: ["push", "schedule"] });
    }
  }

  if (!selectedJobId) {
    throw new Error("no matching prior job in returned pipeline window");
  }

  const bytes = await client.downloadArtifact(
    selectedJobId,
    projectRelativePath(client.ci.projectDirectory, options.historyPath),
  );

  if (bytes.byteLength === 0) {
    throw new Error("empty history artifact");
  }

  await mkdir(dirname(options.historyPath), { recursive: true });
  await writeFile(options.historyPath, bytes);
};

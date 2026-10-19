import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, sep } from "node:path";

import { createGitlabClient, type GitlabClient } from "./client.js";

const previousGitlabJobQuery = `query PreviousGitlabJob($path: ID!, $ref: String!, $source: String!, $job: String!) {
  project(fullPath: $path) {
    pipelines(ref: $ref, source: $source, first: 100) {
      nodes { id source job(name: $job) { id name status retried } }
    }
  }
}`;

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

const selectPreviousJobId = (client: GitlabClient, nodes: GitlabPipelineNode[]): string | undefined => {
  const currentPipelineId = BigInt(client.ci.jobRunUid);
  let previousPipelineId: bigint | undefined;
  let selectedJobId: string | undefined;

  for (const node of nodes) {
    const pipelineId = decodeGitlabId(node.id, "Pipeline");

    if (previousPipelineId !== undefined && pipelineId.value >= previousPipelineId) {
      throw new Error("invalid pipeline order");
    }

    previousPipelineId = pipelineId.value;

    if (node.source !== client.ci.pipelineSource) {
      throw new Error("invalid pipeline source");
    }

    const { job } = node;
    const jobId = job ? decodeGitlabId(job.id, "Build") : undefined;

    if (selectedJobId || pipelineId.value >= currentPipelineId || !job || !jobId) {
      continue;
    }

    if (job.name !== client.ci.ciJobName) {
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
  const response = await client.query<PreviousGitlabJobResponse>(previousGitlabJobQuery, {
    path: client.ci.projectPath,
    ref: client.ci.ref,
    source: client.ci.pipelineSource,
    job: client.ci.ciJobName,
  });
  const selectedJobId = selectPreviousJobId(client, parsePipelines(response));

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

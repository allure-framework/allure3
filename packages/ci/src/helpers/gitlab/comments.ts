import { gitlab } from "../../detectors/gitlab.js";
import type { ReportContext } from "../../reportContext.js";
import { createGitlabClient, type GitlabClient } from "./client.js";
import { renderGitlabReportSummary } from "./summary.js";

const MARKER_VERSION = "v1";
const MAX_NOTE_SCAN_PAGES = 5;
const NOTE_PAGE_SIZE = 100;
const MAX_COMMENT_LENGTH = 60_000;

const isDecimalString = (value: string): boolean => /^[0-9]+$/.test(value);

const encodePathSegment = (value: string): string => encodeURIComponent(value);

const ownershipMarker = ({ jobName, pipelineId, jobId }: ParsedMarker): string =>
  `<!-- allure-gitlab-summary:${MARKER_VERSION}:${jobName}:${pipelineId}:${jobId} -->`;

type GitlabNote = {
  id: string;
  body: string;
};

type ParsedMarker = {
  jobName: string;
  pipelineId: bigint;
  jobId: bigint;
};

const parseNotes = (value: unknown): GitlabNote[] => {
  if (!Array.isArray(value)) {
    throw new Error("invalid notes response");
  }

  return value.map((note) => {
    if (typeof note !== "object" || note === null) {
      throw new Error("invalid notes response");
    }

    const { id, body } = note as { id?: unknown; body?: unknown };
    const textId = typeof id === "number" && Number.isInteger(id) ? String(id) : typeof id === "string" ? id : "";

    if (!textId || typeof body !== "string") {
      throw new Error("invalid notes response");
    }

    return { id: textId, body };
  });
};

const markerPattern = new RegExp(
  `^<!-- allure-gitlab-summary:${MARKER_VERSION}:([A-Za-z0-9+/]+={0,2}):([0-9]+):([0-9]+) -->\\n`,
);

const parseMarker = (body: string): ParsedMarker | undefined => {
  const match = body.match(markerPattern);

  if (!match) {
    return undefined;
  }

  return {
    jobName: match[1],
    pipelineId: BigInt(match[2]),
    jobId: BigInt(match[3]),
  };
};

const compareLogicalRun = (left: ParsedMarker, right: ParsedMarker): number => {
  if (left.pipelineId > right.pipelineId) {
    return 1;
  }

  if (left.pipelineId < right.pipelineId) {
    return -1;
  }

  if (left.jobId > right.jobId) {
    return 1;
  }

  if (left.jobId < right.jobId) {
    return -1;
  }

  return 0;
};

const currentMarker = (client: GitlabClient): ParsedMarker => ({
  // Notes are already scoped to the project and MR; encode the exact name to keep HTML comments safe.
  jobName: Buffer.from(client.ci.ciJobName).toString("base64"),
  pipelineId: BigInt(client.ci.jobRunUid),
  jobId: BigInt(client.ci.currentJobId),
});

const notePath = (client: GitlabClient, iid: string, page?: number): string => {
  const base = `/projects/${encodePathSegment(client.ci.projectId)}/merge_requests/${encodePathSegment(iid)}/notes`;

  return page === undefined ? base : `${base}?per_page=${NOTE_PAGE_SIZE}&page=${page}`;
};

const readOwnedNotes = async (
  client: GitlabClient,
  iid: string,
  currentJobName: string,
): Promise<{ note: GitlabNote; marker: ParsedMarker }[]> => {
  const notes: { note: GitlabNote; marker: ParsedMarker }[] = [];
  let page = 1;

  for (let index = 0; index < MAX_NOTE_SCAN_PAGES; index += 1) {
    const { data, headers } = await client.requestJson<unknown>("GET", notePath(client, iid, page));

    for (const note of parseNotes(data)) {
      const marker = parseMarker(note.body);

      if (marker?.jobName === currentJobName) {
        notes.push({ note, marker });
      }
    }

    const nextPageHeader = headers["x-next-page"];

    if (typeof nextPageHeader !== "string") {
      throw new Error("incomplete note scan");
    }

    const nextPage = nextPageHeader.trim();

    if (!nextPage) {
      return notes;
    }

    const expectedNextPage = String(page + 1);

    if (!isDecimalString(nextPage) || nextPage !== expectedNextPage) {
      throw new Error("incomplete note scan");
    }

    page += 1;
  }

  throw new Error("incomplete note scan");
};

const selectNewestOwnedNote = (notes: { note: GitlabNote; marker: ParsedMarker }[]) =>
  notes.reduce<{ note: GitlabNote; marker: ParsedMarker } | undefined>((selected, candidate) => {
    if (!selected || compareLogicalRun(candidate.marker, selected.marker) > 0) {
      return candidate;
    }

    return selected;
  }, undefined);

export const upsertGitlabJobNote = async (options: {
  token: string;
  summary: ReportContext;
  reportUrl: string;
}): Promise<void> => {
  const iid = gitlab.pullRequest?.id;

  if (!iid || !isDecimalString(iid)) {
    throw new Error("missing merge request");
  }

  if (gitlab.projectId && gitlab.mergeRequestProjectId && gitlab.mergeRequestProjectId !== gitlab.projectId) {
    throw new Error("cross-project merge request");
  }

  const client = createGitlabClient(options);

  if (!client.ci.currentJobId || !isDecimalString(client.ci.currentJobId)) {
    throw new Error("missing current job");
  }

  const current = currentMarker(client);
  const reportUrl = new URL(options.reportUrl);

  if ((reportUrl.protocol !== "http:" && reportUrl.protocol !== "https:") || reportUrl.username || reportUrl.password) {
    throw new Error("invalid report URL");
  }

  const body = `${ownershipMarker(current)}\n${renderGitlabReportSummary(options.summary, reportUrl)}`;

  if (body.length > MAX_COMMENT_LENGTH) {
    throw new Error("comment too large");
  }

  const ownedNotes = await readOwnedNotes(client, iid, current.jobName);
  const selected = selectNewestOwnedNote(ownedNotes);

  if (selected && compareLogicalRun(selected.marker, current) > 0) {
    throw new Error("newer owned note exists");
  }

  if (selected) {
    await client.requestJson("PUT", `${notePath(client, iid)}/${encodePathSegment(selected.note.id)}`, { body });
  } else {
    await client.requestJson("POST", notePath(client, iid), { body });
  }
};

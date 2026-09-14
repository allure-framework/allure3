import { join, relative } from "node:path";

export const isPathInside = (parentPath: string, candidatePath: string) => {
  const rel = relative(parentPath, candidatePath);

  return rel === "" || (!rel.startsWith("..") && rel !== "." && !rel.startsWith("../"));
};

export const resolveAgentIndexPath = (outputDir: string) => join(outputDir, "index.md");

export const formatAgentOutputLinks = (outputDir: string) => [
  `agent output: ${outputDir}`,
  `agent index: ${resolveAgentIndexPath(outputDir)}`,
];

export type ProcessLogStream = "stdout" | "stderr";

const MAX_PROCESS_COMMAND_COMPONENT_LENGTH = 180;

export const sanitizeProcessCommand = (command: string) => {
  const normalized = command.replace(/[^A-Za-z0-9._-]+/g, "_");
  let start = 0;
  let end = normalized.length;

  while (start < end && normalized[start] === "_") {
    start += 1;
  }

  while (end > start && normalized[end - 1] === "_") {
    end -= 1;
  }

  const readable = normalized.slice(start, end);
  const base = readable.length > 0 ? readable : "process";

  return base.slice(0, MAX_PROCESS_COMMAND_COMPONENT_LENGTH);
};

export const formatProcessLogAttachmentName = (command: string, stream: ProcessLogStream) =>
  `${sanitizeProcessCommand(command)}.${stream}.txt`;

export const isProcessLogAttachmentName = (name: string | undefined, stream: ProcessLogStream) =>
  name === `${stream}.txt` || (name?.endsWith(`.${stream}.txt`) ?? false);

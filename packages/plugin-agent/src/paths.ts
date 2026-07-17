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

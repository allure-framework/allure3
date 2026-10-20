import { constants } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export const readAttachmentFile = async (reportDir: string, path: string): Promise<Buffer> => {
  const root = resolve(reportDir);
  const attachmentPath = resolve(root, path);
  const relativePath = relative(root, attachmentPath);

  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error("Attachment path must be inside the report directory");
  }

  const parts = relativePath.split(sep);
  let currentPath = root;
  for (const [index, part] of parts.entries()) {
    currentPath = join(currentPath, part);
    const stats = await lstat(currentPath);
    if (stats.isSymbolicLink()) {
      throw new Error("Symbolic links are not allowed in attachment paths");
    }
    if (index === parts.length - 1 && !stats.isFile()) {
      throw new Error("Attachment path must refer to a regular file");
    }
  }

  return readFile(attachmentPath, { flag: constants.O_RDONLY | constants.O_NOFOLLOW });
};

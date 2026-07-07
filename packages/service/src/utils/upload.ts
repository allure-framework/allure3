import { readFile } from "node:fs/promises";

import type { UploadReportFilePayload } from "../model.js";

export const readUploadContent = async (payload: UploadReportFilePayload) => {
  const { file, filepath, signal } = payload;

  if (file) {
    return file;
  }

  if (!filepath) {
    throw new Error("File or filepath is required");
  }

  return signal ? readFile(filepath, { signal }) : readFile(filepath);
};

export const createUploadForm = async (
  files: UploadReportFilePayload[],
  createUploadBlob: (content: Buffer, filename: string) => Blob,
  signal?: AbortSignal,
  mapFilename?: (filename: string) => string,
) => {
  const entries = await Promise.all(
    files.map(async ({ filename, ...filePayload }) => {
      const reportFilename = mapFilename ? mapFilename(filename) : filename;

      return {
        filename,
        reportFilename,
        content: await readUploadContent({ filename, ...filePayload, signal: signal ?? filePayload.signal }),
      };
    }),
  );

  const form = new FormData();

  for (const { reportFilename, content } of entries) {
    form.append("filename", reportFilename);
    form.append("file", createUploadBlob(content, reportFilename), reportFilename);
  }

  return { entries, form };
};

const DEFAULT_ATTACHMENTS_BASE_PATH = "data/attachments";

export const attachmentSourceUrl = (source: string) => {
  const basePath = (globalThis as { allureAttachmentsBasePath?: string }).allureAttachmentsBasePath;

  return `${basePath ?? DEFAULT_ATTACHMENTS_BASE_PATH}/${source}`;
};

import { fetchReportAttachment } from "@allurereport/web-commons";

export interface Attachments {
  id?: string;
  ext?: string;
  contentType?: string;
}

const fetchFromUrl = async ({ id, ext, contentType }: Attachments) => {
  const fileName = `${id || "-"}${ext || ""}`;

  return fetchReportAttachment(`data/attachments/${fileName}?attachment`, contentType);
};

export const fetchAttachment = async (id: string, ext: string, contentType: string) => {
  if (!id && !ext) {
    return;
  }
  const response = await fetchFromUrl({ id, ext, contentType });
  const fileType = attachmentType(contentType);

  switch (fileType.type) {
    case "svg":
    case "image": {
      const blob = await response.blob();
      const img = URL.createObjectURL(blob);
      return { img, id };
    }
    case "uri":
    case "code":
    case "html":
    case "table":
    case "text": {
      const text = await response.text();
      return { text };
    }
    case "video": {
      const blob = await response.blob();
      const src = URL.createObjectURL(blob);
      return { src, id, contentType };
    }
    default:
      return;
  }
};

export const blobAttachment = async (id: string, ext: string, contentType: string) => {
  const response = await fetchFromUrl({ id, ext, contentType });
  return await response.blob();
};

export const downloadAttachment = async (id: string, ext: string, contentType: string) => {
  if (!id && !ext) {
    return;
  }

  const fileName = `${id}${ext}`;
  const blob = await blobAttachment(id, ext, contentType);
  const linkUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = linkUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(linkUrl);
};

export const openAttachmentInNewTab = async (id: string, ext: string, contentType: string) => {
  if (!id && !ext) {
    return;
  }
  const blob = await blobAttachment(id, ext, contentType);
  const linkUrl = URL.createObjectURL(blob);
  globalThis.open(linkUrl, "_blank");
};

export const attachmentType = (type: string) => {
  switch (type) {
    case "image/bmp":
    case "image/gif":
    case "image/tiff":
    case "image/jpeg":
    case "image/jpg":
    case "image/png":
    case "image/*":
      return {
        type: "image",
        icon: "file",
      };
    case "text/xml":
    case "application/xml":
    case "application/json":
    case "text/json":
    case "text/yaml":
    case "application/yaml":
    case "application/x-yaml":
    case "text/x-yaml":
    case "text/css":
      return {
        type: "code",
        icon: "file",
      };
    case "text/plain":
    case "text/*":
      return {
        type: "text",
        icon: "txt",
      };
    case "text/html":
      return {
        type: "html",
        icon: "file",
      };
    case "text/csv":
      return {
        type: "table",
        icon: "csv",
      };
    case "text/tab-separated-values":
      return {
        type: "table",
        icon: "table",
      };
    case "image/svg+xml":
      return {
        type: "svg",
        icon: "file",
      };
    case "video/mp4":
    case "video/ogg":
    case "video/webm":
      return {
        type: "video",
        icon: "file",
      };
    case "text/uri-list":
      return {
        type: "uri",
        icon: "list",
      };
    case "application/x-tar":
    case "application/x-gtar":
    case "application/x-bzip2":
    case "application/gzip":
    case "application/zip":
      return {
        type: "archive",
        icon: "file",
      };
    default:
      return {
        type: null,
        icon: "file",
      };
  }
};
export const restrictedContentTypes = ["application/gzip"];

import { fetchReportAttachment } from "./data.js";

type AttachmentImageData = {
  img: string;
  id?: string;
};

type AttachmentTextData = {
  text: string;
};

type AttachmentVideoData = {
  src: string;
  id?: string;
  contentType?: string;
};

type AttachmentImageDiffData = {
  diff: {
    actual?: string;
    expected?: string;
    diff?: string;
  };
};

export type AttachmentData = AttachmentImageData | AttachmentTextData | AttachmentVideoData | AttachmentImageDiffData;

type AttachmentPayload = { id?: string; ext?: string; contentType?: string };

export const fetchFromUrl = async ({ id, ext, contentType }: AttachmentPayload) => {
  const fileName = `${id || "-"}${ext || ""}`;

  return fetchReportAttachment(`data/attachments/${fileName}?attachment`, contentType);
};

export const fetchAttachment = async (
  id: string,
  ext: string,
  contentType?: string,
): Promise<AttachmentData | null> => {
  if (!id && !ext) {
    return null;
  }
  const response = await fetchFromUrl({ id, ext, contentType });
  const fileType = attachmentType(contentType);

  if (!response.ok) {
    throw new Error("Failed to fetch");
  }

  switch (fileType) {
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
    case "image-diff": {
      const json = await response.json();
      return { diff: json };
    }
    default:
      return null;
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

export type AttachmentType =
  | "css"
  | "json"
  | "image"
  | "svg"
  | "code"
  | "text"
  | "html"
  | "table"
  | "video"
  | "uri"
  | "archive"
  | "image-diff";

export const attachmentType = (type?: string): AttachmentType | null => {
  switch (type) {
    case "image/bmp":
    case "image/gif":
    case "image/tiff":
    case "image/jpeg":
    case "image/jpg":
    case "image/png":
    case "image/*":
      return "image";
    case "text/xml":
    case "text/json":
    case "text/yaml":
    case "text/javascript":
    case "text/typescript":
    case "text/ruby":
    case "text/python":
    case "text/php":
    case "text/java":
    case "text/csharp":
    case "text/cpp":
    case "text/c":
    case "text/go":
    case "text/rust":
    case "text/swift":
    case "text/kotlin":
    case "text/scala":
    case "text/perl":
    case "text/r":
    case "text/dart":
    case "text/lua":
    case "text/haskell":
    case "text/sql":
    case "text/x-yaml":
    case "text/css":
    case "application/yaml":
    case "application/x-yaml":
    case "application/xml":
    case "application/json":
      return "code";
    case "text/plain":
    case "text/markdown":
    case "text/*":
      return "text";
    case "text/html":
      return "html";
    case "text/csv":
    case "text/tab-separated-values":
      return "table";
    case "image/svg+xml":
      return "svg";
    case "video/mp4":
    case "video/ogg":
    case "video/webm":
      return "video";
    case "text/uri-list":
      return "uri";
    case "application/x-tar":
    case "application/x-gtar":
    case "application/x-bzip2":
    case "application/gzip":
    case "application/zip":
      return "archive";
    case "application/vnd.allure.image.diff":
      return "image-diff";
    default:
      return null;
  }
};
export const restrictedContentTypes = ["application/gzip"];

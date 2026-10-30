export function normalizeAttachmentContentType(type: string): string;
export function normalizeAttachmentContentType(type?: null): undefined;
export function normalizeAttachmentContentType(type?: string | null): string | undefined;
export function normalizeAttachmentContentType(type?: string | null): string | undefined {
  return type?.split(";")[0].trim().toLowerCase();
}

export const isJsonAttachmentContentType = (type: string): boolean => {
  const normalized = normalizeAttachmentContentType(type);
  return normalized === "application/json" || normalized === "text/json" || normalized.endsWith("+json");
};

export const isHtmlAttachmentContentType = (type: string): boolean => {
  const normalized = normalizeAttachmentContentType(type);
  return normalized === "text/html" || normalized === "application/xhtml+xml";
};

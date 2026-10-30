import { attachmentType } from "@allurereport/web-commons";

/**
 * Attachment types the shared renderer can show either as a rendered preview or as source code.
 * Mermaid is left out on purpose: the classic bundle is a single chunk and webpack.config.js aliases
 * `mermaid` to an empty module to keep it small, so Mermaid diagrams are shown as highlighted source only,
 * with no preview toggle. The shared viewer still mounts its hidden preview pane for them; that pane is never shown.
 * Rendering Mermaid in classic needs the alias removed and "mermaid" added here.
 */
const PREVIEW_TYPES = new Set(["html", "markdown"]);

export const hasAttachmentPreview = (contentType?: string) => PREVIEW_TYPES.has(attachmentType(contentType) ?? "");

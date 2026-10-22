import type { FunctionalComponent } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { HTML_PREVIEW_RESIZE_MESSAGE_TYPE, createHtmlPreviewDocument } from "./htmlPreviewDocument";

import styles from "./styles.scss";

const isDarkTheme = (): boolean => {
  const theme = typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null;
  if (theme === "dark") {
    return true;
  }
  if (theme === "light") {
    return false;
  }
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
};

export type HtmlAttachmentPreviewProps = {
  attachment: { text: string };
};

export const HtmlPreview: FunctionalComponent<HtmlAttachmentPreviewProps> = ({ attachment }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const token = useMemo(() => Math.random().toString(36).slice(2), []);
  const [height, setHeight] = useState(0);

  const rawText = attachment.text ?? "";
  const [src, setSrc] = useState("");

  // The document is served from a blob URL rather than `srcdoc`: `about:srcdoc` documents cannot call
  // `history.pushState`, which self-contained pages (e.g. bundled by Zundler) rely on.
  // The URL is revoked as soon as the frame has loaded, so the attachment cannot hand it to the user
  // (e.g. as a link to open in a new tab), where it would run with the origin of the report.
  useEffect(() => {
    if (rawText.length === 0) {
      setSrc("");
      return undefined;
    }

    const html = createHtmlPreviewDocument(rawText, token, isDarkTheme());
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    setSrc(url);

    return () => URL.revokeObjectURL(url);
  }, [rawText, token]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; token?: unknown; height?: unknown } | null;
      const isOwnMessage =
        event.source === iframeRef.current?.contentWindow &&
        data?.type === HTML_PREVIEW_RESIZE_MESSAGE_TYPE &&
        data.token === token;
      const nextHeight = Number(data?.height);

      if (isOwnMessage && Number.isFinite(nextHeight) && nextHeight > 0) {
        setHeight(nextHeight);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, [token]);

  if (!src) {
    return null;
  }

  return (
    <div className={styles["html-attachment-preview"]} data-testid="html-attachment-preview">
      <iframe
        ref={iframeRef}
        title="HTML attachment"
        src={src}
        onLoad={() => URL.revokeObjectURL(src)}
        width="100%"
        height={height || undefined}
        frameBorder="0"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts"
      />
    </div>
  );
};

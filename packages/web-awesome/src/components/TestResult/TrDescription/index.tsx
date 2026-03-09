import { proseStyles, resolveCssVarDeclarations, sanitizeIframeHtml, themeStore } from "@allurereport/web-commons";
import type { FunctionalComponent } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";

import { MetadataButton } from "@/components/MetadataButton";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "./styles.scss";

export type TrDescriptionProps = {
  id?: string;
  descriptionHtml: AwesomeTestResult["descriptionHtml"];
};

const MIN_HEIGHT = 120;

export const TrDescription: FunctionalComponent<TrDescriptionProps> = ({ id, descriptionHtml }) => {
  const descriptionId = id !== null ? `${id}-description` : null;
  const isOpen = !collapsedTrees.value.has(descriptionId);
  const [blobUrl, setBlobUrl] = useState("");
  const [height, setHeight] = useState(MIN_HEIGHT);
  const currentTheme = themeStore.value.current;

  const sanitized = useMemo(() => (descriptionHtml ? sanitizeIframeHtml(descriptionHtml) : ""), [descriptionHtml]);

  useEffect(() => {
    if (!sanitized) {
      setBlobUrl("");
      return;
    }

    const iframeThemeVars = resolveCssVarDeclarations(proseStyles);

    const html = `<!DOCTYPE html>
    <html data-theme="${currentTheme}">
      <head>
        <meta charset="utf-8">
        <style>:root {${iframeThemeVars}}</style>
        <style>${proseStyles}</style>
      </head>
      <body>${sanitized}</body>
    </html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [currentTheme, sanitized]);

  const handleLoad = (e: Event) => {
    const iframe = e.currentTarget as HTMLIFrameElement;
    const documentElement = iframe.contentDocument?.documentElement;
    const body = iframe.contentDocument?.body;
    const scrollHeight = Math.max(documentElement?.scrollHeight ?? 0, body?.scrollHeight ?? 0);
    setHeight(Math.max(scrollHeight, MIN_HEIGHT));
  };

  return (
    <div className={styles["test-result-description"]} data-testid="test-result-description">
      <div className={styles["test-result-description-wrapper"]}>
        <MetadataButton
          title="Description"
          setIsOpen={() => {
            if (descriptionId !== null) {
              toggleTree(descriptionId);
            }
          }}
          isOpened={isOpen}
        />
        {isOpen && (
          <div className={styles["test-result-description-text"]}>
            {blobUrl && (
              <iframe
                data-testid="test-result-description-frame"
                src={blobUrl}
                width="100%"
                height={String(height)}
                style={{ border: 0 }}
                sandbox="allow-same-origin"
                onLoad={handleLoad}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

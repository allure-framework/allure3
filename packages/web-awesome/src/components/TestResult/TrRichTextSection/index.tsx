import { proseStyles, resolveCssVarDeclarations, sanitizeIframeHtml, themeStore } from "@allurereport/web-commons";
import type { FunctionalComponent } from "preact";
import { useMemo, useState } from "preact/hooks";

import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "./styles.scss";

export type TrRichTextSectionProps = {
  id: string;
  section: "description" | "precondition" | "expectedResult";
  html?: string;
};

const getIframeContentHeight = (iframe: HTMLIFrameElement) => {
  const documentElement = iframe.contentDocument?.documentElement;
  const body = iframe.contentDocument?.body;
  const bodyRectHeight = body?.getBoundingClientRect().height ?? 0;
  const scrollHeight = Math.max(body?.scrollHeight ?? 0, documentElement?.scrollHeight ?? 0);

  return Math.ceil(Math.max(bodyRectHeight, scrollHeight));
};

export const TrRichTextSection: FunctionalComponent<TrRichTextSectionProps> = ({ id, html, section }) => {
  const { t } = useI18n("ui");
  const title = t(section);
  const sectionId = `${id}-${section}`;
  const isOpen = !collapsedTrees.value.has(sectionId);
  const [height, setHeight] = useState(0);
  const currentTheme = themeStore.value.current;

  const sanitized = useMemo(() => (html ? sanitizeIframeHtml(html) : ""), [html]);

  const iframeContent = useMemo(() => {
    if (!sanitized) {
      return "";
    }

    const iframeThemeVars = resolveCssVarDeclarations(proseStyles);

    return `<!DOCTYPE html>
    <html data-theme="${currentTheme}">
      <head>
        <meta charset="utf-8">
        <style>:root {${iframeThemeVars}}</style>
        <style>${proseStyles}</style>
      </head>
      <body>${sanitized}</body>
    </html>`;
  }, [currentTheme, sanitized]);

  const handleLoad = (e: Event) => {
    const iframe = e.currentTarget as HTMLIFrameElement;
    setHeight(getIframeContentHeight(iframe));
  };

  return (
    <div className={styles["test-result-rich-text-section"]} data-testid={`test-result-${section}`}>
      <div className={styles["test-result-rich-text-section-wrapper"]}>
        <MetadataButton
          title={title}
          aria-expanded={isOpen}
          setIsOpen={() => toggleTree(sectionId)}
          isOpened={isOpen}
        />
        {isOpen && (
          <div className={styles["test-result-rich-text-section-text"]}>
            {iframeContent && (
              <iframe
                data-testid={`test-result-${section}-frame`}
                title={title}
                srcDoc={iframeContent}
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

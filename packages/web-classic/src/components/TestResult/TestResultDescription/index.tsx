import { proseStyles, resolveCssVarDeclarations, sanitizeIframeHtml, themeStore } from "@allurereport/web-commons";
import type { FunctionalComponent } from "preact";
import { useMemo, useState } from "preact/hooks";

import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

export type TestResultRichTextSection = "description" | "precondition" | "expectedResult";

export type TestResultDescriptionProps = {
  /** which rich text of the test result is rendered; the section title is translated by this key */
  section?: TestResultRichTextSection;
  html?: string;
};

const getIframeContentHeight = (iframe: HTMLIFrameElement) => {
  const documentElement = iframe.contentDocument?.documentElement;
  const body = iframe.contentDocument?.body;
  const bodyRectHeight = body?.getBoundingClientRect().height ?? 0;
  const scrollHeight = Math.max(body?.scrollHeight ?? 0, documentElement?.scrollHeight ?? 0);

  return Math.ceil(Math.max(bodyRectHeight, scrollHeight));
};

export const TestResultDescription: FunctionalComponent<TestResultDescriptionProps> = ({
  section = "description",
  html,
}) => {
  const { t } = useI18n("ui");
  const title = t(section);
  const [isOpen, setIsOpen] = useState(true);
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
    setHeight(getIframeContentHeight(e.currentTarget as HTMLIFrameElement));
  };

  return (
    <div className={styles["test-result-description"]} data-testid={`test-result-${section}`}>
      <div className={styles["test-result-description-wrapper"]}>
        <MetadataButton title={title} setIsOpen={setIsOpen} isOpened={isOpen} />
        {isOpen && (
          <div className={styles["test-result-description-text"]}>
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

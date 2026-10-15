import type { FunctionalComponent } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import { EmptyView } from "@/components/EmptyView";
import { Spinner } from "@/components/Spinner";

import { renderMermaid } from "./mermaid";

import styles from "./styles.scss";

let diagramSequence = 0;

const getCurrentTheme = () =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light";

export type MermaidAttachmentPreviewProps = {
  attachment: { text: string };
};

export const MermaidPreview: FunctionalComponent<MermaidAttachmentPreviewProps> = ({ attachment }) => {
  const diagramId = useMemo(() => `allure-mermaid-${++diagramSequence}`, []);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(getCurrentTheme);
  const definition = attachment.text ?? "";

  useEffect(() => {
    const observer = new MutationObserver(() => setCurrentTheme(getCurrentTheme()));

    observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    setSvg("");
    setError(false);

    if (!definition.trim()) {
      return () => {
        active = false;
      };
    }

    void renderMermaid(diagramId, definition, currentTheme === "dark" ? "dark" : "default")
      .then((renderedSvg) => {
        if (active) {
          setSvg(renderedSvg);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [currentTheme, definition, diagramId]);

  if (!definition.trim()) {
    return null;
  }

  if (error) {
    return <EmptyView description="Failed to render Mermaid diagram" size="xs" />;
  }

  if (!svg) {
    return (
      <div className={styles["mermaid-attachment-loading"]} data-testid="mermaid-attachment-loading">
        <Spinner />
      </div>
    );
  }

  return (
    <div
      className={styles["mermaid-attachment-preview"]}
      data-testid="mermaid-attachment-preview"
      // Mermaid runs with securityLevel=strict, which escapes HTML labels and disables links.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

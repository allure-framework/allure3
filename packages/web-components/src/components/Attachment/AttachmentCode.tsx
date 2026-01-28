import { ansiToHTML, isAnsi } from "@allurereport/web-commons";
import { useEffect } from "preact/hooks";
import Prism from "prismjs";
import "./code.scss";
import type { AttachmentProps } from "./model";

export const AttachmentCode = (props: AttachmentProps) => {
  const { attachment, item } = props;

  useEffect(() => {
    Prism.highlightAll();
  }, [attachment]);

  if (!attachment || !("text" in attachment)) {
    return null;
  }

  const ext = item?.link?.ext?.replace(".", "") ?? "plaintext";
  const rawText = attachment.text ?? "";

  if (isAnsi(rawText) && rawText.length > 0) {
    const sanitizedText = ansiToHTML(rawText, {
      fg: "var(--on-text-primary)",
      bg: "none",
      colors: {
        0: "none",
        1: "none",
        2: "var(--on-support-sirius)",
        3: "var(--on-support-atlas)",
        4: "var(--bg-support-skat)",
        5: "var(--on-support-betelgeuse)",
      },
    });

    return (
      <pre
        data-testid="code-attachment-content"
        key={item?.link?.id}
        className={`language-${ext} line-numbers`}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: sanitizedText }}
      />
    );
  }

  return (
    <pre
      data-testid={"code-attachment-content"}
      key={item?.link?.id}
      className={`language-${item?.link?.ext?.replace(".", "")} line-numbers`}
    >
      <code className={`language-${ext}`}>{rawText}</code>
    </pre>
  );
};

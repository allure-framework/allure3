import { type AttachmentTestStepResult } from "@allurereport/core-api";
import { type FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import Prism from "prismjs";
import "./code.scss";
import { isAnsi, ansiToHTML } from "@allurereport/web-commons";

export const AttachmentCode: FunctionalComponent<{
  item: AttachmentTestStepResult;
  attachment: { text?: string };
}> = ({ attachment, item }) => {
  useEffect(() => {
    Prism.highlightAll();
  }, [attachment]);

  const ext = item?.link?.ext?.replace(".", "") ?? "plaintext";
  const rawText = attachment.text ?? "";

  if (isAnsi(rawText)) {
    const sanitizedText = rawText.length > 0 ? ansiToHTML(rawText, {
      fg: "var(--on-text-primary)",
    }) : "";

    return (
      <pre
        data-testid="code-attachment-content"
        key={item?.link?.id}
        className={`language-${ext} line-numbers`}
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

import { type AttachmentTestStepResult } from "@allurereport/core-api";
import AnsiToHtml from "ansi-to-html";
import { type FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import Prism from "prismjs";
import "./code.scss";

const ansiRegex = /\x1B\[[0-9;?]*[ -/]*[@-~]/g;

const ansiTrace = (text: string) =>
  new AnsiToHtml({
    fg: "var(--on-text-primary)",
  }).toHtml(text);

const isAnsi = (text?: string): boolean => typeof text === "string" && new RegExp(ansiRegex).test(text);

export const AttachmentCode: FunctionalComponent<{
  item: AttachmentTestStepResult;
  attachment: { text?: string };
}> = ({ attachment, item }) => {
  useEffect(() => {
    Prism.highlightAll();
  }, [attachment]);

  const ext = item?.link?.ext?.replace(".", "") ?? "plaintext";
  const rawText = attachment.text ?? "";

  return (
    <>
      {isAnsi(rawText) ? (
        <pre
          data-testid="code-attachment-content"
          key={item?.link?.id}
          className={`language-${ext} line-numbers`}
          dangerouslySetInnerHTML={{ __html: ansiTrace(rawText) }}
        />
      ) : (
        <pre
          data-testid={"code-attachment-content"}
          key={item?.link?.id}
          className={`language-${item?.link?.ext?.replace(".", "")} line-numbers`}
        >
          <code className={`language-${ext}`}>{rawText}</code>
        </pre>
      )}
    </>
  );
};

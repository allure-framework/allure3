import { type AttachmentTestStepResult } from "@allurereport/core-api";
import { type FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import Prism from "prismjs";
import "@/assets/scss/code.scss";

export const AttachmentCode: FunctionalComponent<{
  item: AttachmentTestStepResult;
  attachment: { text?: string };
}> = ({ attachment, item }) => {
  useEffect(() => {
    Prism.highlightAll();
  }, [attachment]);

  return (
    <pre key={item?.link?.id} className={`language-${item?.link?.ext?.replace(".", "")} line-numbers`}>
      <code>{attachment?.text}</code>
    </pre>
  );
};

import { useEffect } from "preact/hooks";
import Prism from "prismjs";
import "@/assets/scss/code.css";

export const AttachmentCode = ({ attachment, item }) => {
  useEffect(() => {
    Prism.highlightAll();
  }, [attachment]);

  return (
    <pre key={item?.link?.id} className={`language-${item?.link?.ext?.replace(".", "")} line-numbers`}>
      <code>{attachment?.text}</code>
    </pre>
  );
};

import { useEffect, useRef } from "preact/hooks";
import * as styles from "./styles.scss";

export const PwTrace = ({ blob }: any) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleLoad = () => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { method: "load", params: { trace: blob } },
          "https://trace.playwright.dev",
        );
      }
    };

    if (iframeRef.current) {
      iframeRef.current.onload = handleLoad;
    }
  }, [blob]);
  return (
    <iframe
      className={styles["pw-trace"]}
      ref={iframeRef}
      width={"100%"}
      height={"100%"}
      src={"https://trace.playwright.dev/next/"}
    />
  );
};

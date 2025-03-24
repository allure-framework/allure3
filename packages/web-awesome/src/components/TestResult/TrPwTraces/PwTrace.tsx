import clsx from "clsx";
import { useEffect, useRef } from "preact/hooks";
import * as styles from "./styles.scss";

interface PwTraceProps {
  blob: Blob;
  isFullScreen?: boolean;
}
export const PwTrace = ({ blob, isFullScreen }: PwTraceProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { method: "load", params: { trace: blob } },
      "https://trace.playwright.dev",
    );
  };

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.onload = handleLoad;
    }
  }, [blob]);

  return (
    <iframe
      className={clsx(styles["pw-trace"], { [styles["pw-trace-fullscreen"]]: isFullScreen })}
      ref={iframeRef}
      width={"100%"}
      height={"100%"}
      src={"https://trace.playwright.dev/next/"}
    />
  );
};

import clsx from "clsx";
import type { ComponentChildren, FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import Prism from "prismjs";
import "./code.scss";

export const CodeViewer: FunctionalComponent<{
  code?: string;
  children?: ComponentChildren;
  className?: string;
}> = ({ code, children, className }) => {
  const languageCode = "language-text";

  useEffect(() => {
    Prism.highlightAll();
  }, []);

  return (
    <pre className={clsx(`${languageCode} line-numbers language-diff`, className)}>
      {code && <code>{code}</code>}
      {children}
    </pre>
  );
};

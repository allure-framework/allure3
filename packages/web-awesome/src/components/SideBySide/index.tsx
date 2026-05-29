import type { JSX } from "preact";
import { useEffect, useMemo, useRef } from "preact/hooks";
import Split from "split.js";

import { activePane, focusTestResultPane, focusTreePane } from "@/stores/keyboard";

import * as styles from "./styles.scss";

const SideBySide = ({ left, right }: { left: JSX.Element; right: JSX.Element }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const leftContent = useMemo(() => left, [left]);
  const rightContent = useMemo(() => right, [right]);

  useEffect(() => {
    const sizes = JSON.parse(localStorage.getItem("sideBySidePosition") || "[50, 50]");

    const splitter = Split([`.${styles["side-left"]}`, `.${styles["side-right"]}`], {
      sizes,
      gutterSize: 4,
      gutter: (): HTMLElement => {
        const gutter = document.createElement("div");
        gutter.className = `${styles.gutter}`;
        gutter.addEventListener("dblclick", () => {
          const currentSizes = splitter.getSizes();
          if (JSON.stringify(currentSizes) === "[50,50]") {
            splitter.setSizes([30, 70]);
            localStorage.setItem("sideBySidePosition", JSON.stringify([30, 70]));
            return;
          }
          splitter.setSizes([50, 50]);
          localStorage.setItem("sideBySidePosition", JSON.stringify([50, 50]));
        });
        return gutter;
      },
      onDragEnd: () => {
        const newSizes = splitter.getSizes();
        localStorage.setItem("sideBySidePosition", JSON.stringify(newSizes));
      },
    });

    return () => {
      splitter.destroy();
    };
  }, []);

  const pane = activePane.value;

  return (
    <div class={styles.side} ref={containerRef}>
      <div
        class={styles["side-left"]}
        data-pane="tree"
        data-pane-active={pane === "tree" ? "true" : undefined}
        onMouseDown={() => focusTreePane()}
      >
        {leftContent}
      </div>
      <div
        class={styles["side-right"]}
        data-pane="testResult"
        data-pane-active={pane === "testResult" ? "true" : undefined}
        onMouseDown={() => focusTestResultPane()}
      >
        {rightContent}
      </div>
    </div>
  );
};

export default SideBySide;

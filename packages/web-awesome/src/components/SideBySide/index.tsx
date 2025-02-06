import type { ComponentChild, FunctionalComponent } from "preact";
import { useEffect, useRef } from "preact/hooks";
import Split from "split.js";
import * as styles from "./styles.scss";

interface SideBySideProps {
  left: ComponentChild;
  right?: ComponentChild;
}

const SideBySide: FunctionalComponent<SideBySideProps> = ({ left, right }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sizes = JSON.parse(localStorage.getItem("sideBySidePosition") || "[50, 50]");

    const splitter = Split([`.${styles["side-left"]}`, `.${styles["side-right"]}`], {
      sizes,
      gutterSize: 7,
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

  return (
    <div class={styles.side} ref={containerRef}>
      <div class={styles["side-left"]}>{left}</div>
      <div class={styles["side-right"]}>{right}</div>
    </div>
  );
};

export default SideBySide;

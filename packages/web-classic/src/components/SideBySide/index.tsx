import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChild, FunctionalComponent } from "preact";
import { useEffect, useRef } from "preact/hooks";
import Split from "split.js";

import { useI18n } from "@/stores";
import { navigateTo, route } from "@/stores/router";

import * as styles from "./styles.scss";

interface SideBySideProps {
  left: ComponentChild;
  right?: ComponentChild;
}

const SideBySide: FunctionalComponent<SideBySideProps> = ({ left, right }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t: controls } = useI18n("controls");
  const { t: nav } = useI18n("nav");
  const { tabName, params } = route.value;
  const isSelected = Boolean(params.testResultId);

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
    <div class={clsx(styles.side, isSelected && styles["side-selected"])} ref={containerRef}>
      <div class={styles["side-left"]}>{left}</div>
      <div class={styles["side-right"]}>
        {/* On narrow screens only one pane fits, so the test result gets a way back to the tree */}
        {isSelected && (
          <a
            href={`#${tabName}`}
            className={styles["side-back"]}
            data-testid="side-back"
            onClick={(event) => {
              event.preventDefault();
              navigateTo({ tabName, params: { id: params.id } });
            }}
          >
            <SvgIcon id={allureIcons.lineArrowsArrowLeft} size="s" />
            <Text type="ui" size="m">
              {controls("backto")} {nav(tabName)}
            </Text>
          </a>
        )}
        {right}
      </div>
    </div>
  );
};

export default SideBySide;

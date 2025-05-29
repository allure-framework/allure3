import type { VNode } from "preact";
import { Charts } from "@/components/Charts";
import { Report } from "@/components/Report";
import { currentSection } from "@/stores/sections";
import * as styles from "./styles.scss";

export const SectionSwitcher = () => {
  const sectionMap: Record<string, VNode> = {
    report: <Report />,
    charts: <Charts />,
  };

  return <div className={styles.layout}>{sectionMap[currentSection.value] || sectionMap.report}</div>;
};

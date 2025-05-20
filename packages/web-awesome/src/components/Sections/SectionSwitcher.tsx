import type { VNode } from "preact";
import { Charts } from "@/components/Sections/Charts";
import { Report } from "@/components/Sections/Report";
import { currentSection } from "@/stores/sections";

export const SectionSwitcher = () => {
  const sectionMap: Record<string, VNode> = {
    report: <Report />,
    charts: <Charts />,
  };

  return <>{sectionMap[currentSection.value] || sectionMap.report}</>;
};

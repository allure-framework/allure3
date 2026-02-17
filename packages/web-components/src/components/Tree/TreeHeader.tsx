import { type Statistic } from "@allurereport/core-api";
import type { Status } from "global";
import type { ComponentChildren, FunctionComponent } from "preact";
import { TreeSection } from "./TreeSection";
import { TreeStatusBar } from "./TreeStatusBar";

interface TreeHeaderProps {
  statistic?: Statistic;
  reportStatistic?: Statistic;
  categoryTitle: ComponentChildren;
  isOpened: boolean;
  toggleTree: () => void;
  statusFilter?: Status;
  style?: Record<string, string>;
}

export const TreeHeader: FunctionComponent<TreeHeaderProps> = ({
  categoryTitle,
  isOpened,
  toggleTree,
  statistic,
  reportStatistic,
  statusFilter,
  ...rest
}) => {
  return (
    <TreeSection {...rest} title={categoryTitle} isOpened={isOpened} toggleTree={toggleTree}>
      <TreeStatusBar reportStatistic={reportStatistic} statusFilter={statusFilter} statistic={statistic} />
    </TreeSection>
  );
};

import { type Statistic } from "@allurereport/core-api";
import type { ComponentChildren, FunctionComponent } from "preact";

import type { Status } from "../../../global";
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
  actions?: ComponentChildren;
}

export const TreeHeader: FunctionComponent<TreeHeaderProps> = ({
  categoryTitle,
  isOpened,
  toggleTree,
  statistic,
  reportStatistic,
  statusFilter,
  actions,
  ...rest
}) => {
  return (
    <TreeSection {...rest} title={categoryTitle} isOpened={isOpened} toggleTree={toggleTree}>
      {actions}
      <TreeStatusBar reportStatistic={reportStatistic} statusFilter={statusFilter} statistic={statistic} />
    </TreeSection>
  );
};

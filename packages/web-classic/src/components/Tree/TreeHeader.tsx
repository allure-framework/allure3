import { type Statistic, statusesList } from "@allurereport/core-api";
import { Text } from "@allurereport/web-components";
import { clsx } from "clsx";
import { type FunctionComponent } from "preact";

import { ArrowButton } from "@/components/ArrowButton";

import { useTreeStore } from "./context";

import * as styles from "./styles.scss";

interface TreeHeaderProps {
  statistic?: Statistic;
  categoryTitle: string;
  isOpened: boolean;
  isMarked?: boolean;
  toggleTree: () => void;
}

const maxWidthTab = 140;
const minWidthTab = 46;
// to make the progress bar more visually responsive for smaller values,
// we can adjust the formula by adding an offset to stretch the lower part
// of the logarithmic scale
const offset = 10;

const progress = (current: number, total: number) => {
  const logOffset = Math.log(offset);
  return (Math.log(current + offset) - logOffset) / (Math.log(total + offset) - logOffset);
};

const TreeHeader: FunctionComponent<TreeHeaderProps> = ({
  categoryTitle,
  isOpened,
  isMarked,
  toggleTree,
  statistic,
  ...rest
}) => {
  const { filters, showGroupsInfo, stats } = useTreeStore();
  const { status: statusFilter } = filters.value;
  // the bar is scaled against all tests of the current tree, like in Allure 2
  const treeTotal = stats.value?.total ?? statistic?.total ?? 0;
  const width = Math.floor(progress(statistic?.total ?? 0, treeTotal) * (maxWidthTab - minWidthTab) + minWidthTab);

  const treeHeaderBar =
    statistic && showGroupsInfo.value
      ? statusesList
          .map((status) => ({ status, value: statistic[status] }))
          .filter(
            ({ status, value }) =>
              value !== undefined && (statusFilter === "total" || (statusFilter === status && value > 0)),
          )
          .map(({ status, value }) => {
            const className = clsx(styles["tree-header-bar-item"], styles[status]);
            const style = { flexGrow: value };

            return (
              <div key={status} className={className} style={style}>
                {value}
              </div>
            );
          })
      : null;

  return (
    <div
      data-testid="tree-header"
      {...rest}
      className={clsx(styles["tree-header"], isMarked && styles["tree-header-marked"])}
      onClick={toggleTree}
    >
      <ArrowButton data-testid="tree-arrow" isOpened={isOpened} />
      <Text data-testid="tree-header-title" size="m" bold className={styles["tree-header-title"]}>
        {categoryTitle}
      </Text>
      {treeHeaderBar && (
        <div data-testid="tree-header-bar" className={styles["tree-header-bar"]} style={{ minWidth: `${width}px` }}>
          {treeHeaderBar}
        </div>
      )}
    </div>
  );
};

export default TreeHeader;

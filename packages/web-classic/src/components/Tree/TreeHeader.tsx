import { type Statistic, statusesList } from "@allurereport/core-api";
import { Loadable, Text } from "@allurereport/web-components";
import { clsx } from "clsx";
import { type FunctionComponent } from "preact";
import { ArrowButton } from "@/components/ArrowButton";
import { statsStore } from "@/stores";
import { route } from "@/stores/router";
import { treeFiltersStore } from "@/stores/tree";
import * as styles from "./styles.scss";

interface TreeHeaderProps {
  statistic?: Statistic;
  categoryTitle: string;
  isOpened: boolean;
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
  toggleTree,
  statistic,
  ...rest
}) => {
  const { status: statusFilter } = treeFiltersStore.value;

  return (
    <Loadable
      source={statsStore}
      renderData={(stats: Statistic) => {
        const width = Math.floor(progress(statistic.total, stats.total) * (maxWidthTab - minWidthTab) + minWidthTab);

        const treeHeaderBar = statistic
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
          <div data-testid="tree-header" {...rest} className={styles["tree-header"]} onClick={toggleTree}>
            <ArrowButton data-testid="tree-arrow" isOpened={isOpened} />
            <Text data-testid="tree-header-title" size="m" bold className={styles["tree-header-title"]}>
              {categoryTitle}
            </Text>
            {treeHeaderBar && (
              <div className={styles["tree-header-bar"]} style={{ width: `${width}px` }}>
                {treeHeaderBar}
              </div>
            )}
          </div>
        );
      }}
    />
  );
};

export default TreeHeader;

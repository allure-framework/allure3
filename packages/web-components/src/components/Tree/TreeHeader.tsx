import { type Statistic, statusesList } from "@allurereport/core-api";
import type { Signal } from "@preact/signals";
import { clsx } from "clsx";
import type { TreeFiltersState } from "global";
import { type FunctionComponent } from "preact";
import type { StoreSignalState } from "@/components/Loadable";
import { Loadable } from "@/components/Loadable";
import { TreeSection } from "./TreeSection";
import styles from "./styles.scss";

interface TreeHeaderProps {
  statistic?: Statistic;
  categoryTitle: string;
  isOpened: boolean;
  toggleTree: () => void;
  statsStore: Signal<StoreSignalState<Statistic>>;
  treeFiltersStore: TreeFiltersState;
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

export const TreeHeader: FunctionComponent<TreeHeaderProps> = ({
  categoryTitle,
  isOpened,
  toggleTree,
  statistic,
  statsStore,
  treeFiltersStore,
  ...rest
}) => {
  const { status: statusFilter } = treeFiltersStore;

  return (
    <Loadable
      source={statsStore}
      renderData={(stats: Statistic) => {
        const width = Math.floor(
          progress(statistic?.total || 0, stats.total) * (maxWidthTab - minWidthTab) + minWidthTab,
        );

        const treeHeaderBar = statistic
          ? statusesList
              .map((status) => ({ status, value: statistic[status] }))
              .filter(({ status, value }) => {
                return value !== undefined && (statusFilter === "total" || (statusFilter === status && value > 0));
              })
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
          <TreeSection {...rest} title={categoryTitle} isOpened={isOpened} toggleTree={toggleTree}>
            {treeHeaderBar && (
              <div className={styles["tree-header-bar"]} style={{ width: `${width}px` }}>
                {treeHeaderBar}
              </div>
            )}
          </TreeSection>
        );
      }}
    />
  );
};

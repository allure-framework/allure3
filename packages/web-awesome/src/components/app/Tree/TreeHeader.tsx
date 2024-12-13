import { Statistic, statusesList } from "@allurereport/core-api";
import { clsx } from "clsx";
import { FunctionComponent } from "preact";
import { ArrowButton } from "@/components/app/ArrowButton";
import { Loadable } from "@/components/commons/Loadable";
import { Text } from "@/components/commons/Typography";
import { statsStore } from "@/stores";
import * as styles from "./styles.scss";

interface TreeHeaderProps {
  statistic?: Statistic;
  categoryTitle: string;
  isOpened: boolean;
  toggleTree: () => void;
  statusFilter?: string;
}

const maxWidthTab: number = 140;
const minWidthTab: number = 46;
// to make the progress bar more visually responsive for smaller values,
// we can adjust the formula by adding an offset to stretch the lower part
// of the logarithmic scale
const offset: number = 10;

const progress = (current: number, total: number) => {
  const logOffset = Math.log(offset);
  return (Math.log(current + offset) - logOffset) / (Math.log(total + offset) - logOffset);
};

const TreeHeader: FunctionComponent<TreeHeaderProps> = ({
  categoryTitle,
  isOpened,
  toggleTree,
  statusFilter = "total",
  statistic,
  ...rest
}) => {
  return (
    <Loadable
      source={statsStore}
      renderData={(stats) => {
        const width = Math.floor(progress(statistic.total, stats.total) * (maxWidthTab - minWidthTab) + minWidthTab);

        const treeHeaderBar = statistic
          ? statusesList
              .map((status) => ({ status, value: statistic[status] }))
              .filter(
                ({ status, value }) =>
                  value !== undefined && (statusFilter === "total" || (statusFilter === status && value > 0)),
              )
              .map(({ status, value }) => {
                const className = clsx(styles[`tree-header-bar-item`], styles[status]);
                const style = { flexGrow: `${value}` };

                return (
                  <div key={status} className={className} style={style}>
                    {value}
                  </div>
                );
              })
          : null;

        return (
          <div {...rest} className={styles["tree-header"]} onClick={toggleTree}>
            <ArrowButton isOpened={isOpened} />
            <Text size="m" bold className={styles["tree-header-title"]}>
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

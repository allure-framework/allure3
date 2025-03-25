import { type Statistic, statusesList } from "@allurereport/core-api";
import { clsx } from "clsx";
import type { Status } from "global";
import { type FunctionalComponent } from "preact";
import styles from "./styles.scss";

interface TreeStatusBarProps {
  statistic?: Statistic;
  reportStatistic?: Statistic;
  maxWidth?: number;
  minWidth?: number;
  // to make the progress bar more visually responsive for smaller values,
  // we can adjust the formula by adding an offset to stretch the lower part
  // of the logarithmic scale
  offset?: number;
  statusFilter?: Status;
}

export const TreeStatusBar: FunctionalComponent<TreeStatusBarProps> = ({
  statistic,
  statusFilter,
  reportStatistic,
  maxWidth = 140,
  minWidth = 46,
  offset = 10,
}) => {
  const progress = (current: number, total: number) => {
    const logOffset = Math.log(offset);

    return (Math.log(current + offset) - logOffset) / (Math.log(total + offset) - logOffset);
  };
  const width = Math.floor(
    progress(statistic?.total ?? 0, reportStatistic?.total ?? 0) * (maxWidth - minWidth) + minWidth,
  );

  if (!statistic) {
    return null;
  }

  return (
    <div className={styles["tree-status-bar"]} style={{ width: `${width}px` }}>
      {statusesList
        .map((status) => ({ status, value: statistic[status] }))
        .filter(({ status, value }) => {
          return value !== undefined && (statusFilter === "total" || (statusFilter === status && value > 0));
        })
        .map(({ status, value }) => {
          const className = clsx(styles["tree-status-bar-item"], styles[status]);
          const style = { flexGrow: value };

          return (
            <div key={status} className={className} style={style}>
              {value}
            </div>
          );
        })}
    </div>
  );
};

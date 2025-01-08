import type { TestStatus } from "@allurereport/core-api";
import { clsx } from "clsx";
import { Text } from "@/components/Typography";
import styles from "./styles.scss";

type Props = {
  size?: "s" | "m" | "l";
  count: number;
  truncateCount?: boolean;
  status?: TestStatus;
};

export const Counter = (props: Props) => {
  const { count, size = "s", truncateCount = false, status } = props;

  const displayedCount = truncateCount && count > 99 ? "99+" : count;

  return (
    <Text
      tag="small"
      size={size === "l" ? "m" : "s"}
      type="ui"
      bold
      className={clsx(styles.counter, styles[`size-${size}`], status && styles[`status-${status}`])}
    >
      {displayedCount}
    </Text>
  );
};

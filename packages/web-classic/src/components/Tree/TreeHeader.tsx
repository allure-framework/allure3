import { type Statistic } from "@allurereport/core-api";
import { Text } from "@allurereport/web-components";
import { type FunctionComponent } from "preact";
import { ArrowButton } from "@/components/ArrowButton";
import * as styles from "./styles.scss";

interface TreeHeaderProps {
  statistic?: Statistic;
  categoryTitle: string;
  isOpened: boolean;
  toggleTree: () => void;
}

const TreeHeader: FunctionComponent<TreeHeaderProps> = ({
  categoryTitle,
  isOpened,
  toggleTree,
  statistic,
  ...rest
}) => {
  return (
    <div data-testid="tree-header" {...rest} className={styles["tree-header"]} onClick={toggleTree}>
      <ArrowButton data-testid="tree-arrow" isOpened={isOpened} />
      <Text data-testid="tree-header-title" size="m" bold className={styles["tree-header-title"]}>
        {categoryTitle}
      </Text>
    </div>
  );
};

export default TreeHeader;

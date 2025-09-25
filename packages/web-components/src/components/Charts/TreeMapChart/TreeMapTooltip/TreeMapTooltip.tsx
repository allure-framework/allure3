import type { TreeMapNode } from "@allurereport/core-api";
import type { ComputedNode, DefaultTreeMapDatum } from "@nivo/treemap";
import type { FunctionalComponent } from "preact";
import type { ReactNode } from "preact/compat";
import { Text } from "@/components/Typography/index.js";
import styles from "./styles.scss";

export interface TreeMapTooltipProps<T extends DefaultTreeMapDatum = TreeMapNode> {
  node: ComputedNode<T>;
  rows?: ReactNode[];
}

export const TreeMapTooltip: FunctionalComponent<TreeMapTooltipProps> = ({ node, rows }: TreeMapTooltipProps) => {
  const { id, formattedValue, color, parentLabel } = node;
  const title = parentLabel ? parentLabel : id;

  return (
    <div className={styles["tree-map-tooltip"]}>
      <div className={styles["tree-map-tooltip-title"]}>
        <span className={styles["tree-map-tooltip-title-color"]} style={{ backgroundColor: color }} />
        <Text size="s" type="ui">
          {title}:
        </Text>
        <Text size="s" type="ui" bold>
          {formattedValue}
        </Text>
      </div>
      {rows && (
        <div className={styles["tree-map-tooltip-rows"]}>
          {rows.map((row) => (
            <Text size="s" type="ui" className={styles["tree-map-tooltip-row"]} key={row}>
              {row}
            </Text>
          ))}
        </div>
      )}
    </div>
  );
};

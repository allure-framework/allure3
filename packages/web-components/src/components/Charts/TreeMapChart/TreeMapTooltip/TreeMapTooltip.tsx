import type { TreeMapNode } from "@allurereport/charts-api";
import type { ComputedNode, DefaultTreeMapDatum } from "@nivo/treemap";
import type { FunctionalComponent } from "preact";
import type { ReactNode } from "preact/compat";
import { ChartTooltip } from "../../ChartTooltip";
import { LegendItem } from "../../Legend/LegendItem";

export interface TreeMapTooltipProps<T extends DefaultTreeMapDatum = TreeMapNode> {
  node: ComputedNode<T>;
  rows?: ReactNode[];
}

export const TreeMapTooltip: FunctionalComponent<TreeMapTooltipProps> = ({ node, rows }: TreeMapTooltipProps) => {
  const { id, formattedValue, color, parentLabel } = node;
  const title = parentLabel ? parentLabel : id;

  return (
    <ChartTooltip label={`${title}: ${formattedValue}`} labelColor={color}>
      {rows &&
        rows.map((row, index) => (
          <LegendItem
            key={index.toString()}
            mode="default"
            legend={{ label: row as string, type: "none", id: index.toString(), color: color }}
            hideOnEmptyValue={false}
          />
        ))}
    </ChartTooltip>
  );
};

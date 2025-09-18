import type { ComputedNodeWithoutStyles, DefaultTreeMapDatum } from "@nivo/treemap";
import type { ParentLabelControlOptions } from "./types";

export const DEFAULT_PARENT_SKIP_SIZE = 48;

export const createCustomParentLabelControl = <T extends DefaultTreeMapDatum>({
  parentSkipSize = DEFAULT_PARENT_SKIP_SIZE,
}: ParentLabelControlOptions) => {
  return (node: ComputedNodeWithoutStyles<T>) => {
    const { width, height, data = {} as Record<string, any> } = node;
    const minSize = Math.min(width, height);

    if (minSize < parentSkipSize) {
      return "";
    }

    return String(data[node.parentLabel] ?? node.id);
  };
};

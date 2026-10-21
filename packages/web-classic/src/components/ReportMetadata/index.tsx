import type { EnvironmentItem } from "@allurereport/core-api";

export interface MetadataItem extends EnvironmentItem {
  value?: string;
}

export type MetadataProps = {
  envInfo?: MetadataItem[];
  size?: "s" | "m";
  groupedLabels?: Record<string, string[]>;
};

export interface LegendItemValue<T extends Record<string, number | string>> {
  id: Extract<keyof T, string>;
  color: string;
  border?: string;
  pointHoverColor?: string;
  label: string | number;
  type?: "default" | "point" | "tree";
  link?: string;
  value?: string | number;
}

export interface LegendItemProps<T extends Record<string, number | string>> {
  legend: LegendItemValue<T>;
  mode?: "default" | "menu";
  onClick?: (item: LegendItemValue<T>) => void;
}

export interface TreeMapLegendProps {
  minValue?: number;
  maxValue?: number;
  colorFn: (value: number, domain?: number[]) => string;
  formatValue?: (value: number) => string;
  domain?: number[];
}

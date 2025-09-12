export interface TreeMapLegendProps {
  minValue: number;
  maxValue: number;
  colorFn: (value: number) => string;
  formatValue?: (value: number) => string;
}

export interface TreeMapLegendProps {
  minValue: number;
  maxValue: number;
  colorFunction: (value: number) => string;
  formatValue?: (value: number) => string;
}

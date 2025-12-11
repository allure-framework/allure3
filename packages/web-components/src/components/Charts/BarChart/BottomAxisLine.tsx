import type { BarCustomLayerProps } from "@nivo/bar";
import { useTheme } from "@nivo/theming";

export const BottomAxisLine = (props: BarCustomLayerProps<any>) => {
  const { background: chartBackgroundColor, grid } = useTheme();

  return (
    <g>
      <line
        opacity="1"
        x1="0"
        x2={props.innerWidth}
        y1={props.innerHeight}
        y2={props.innerHeight}
        stroke={chartBackgroundColor}
        strokeWidth="1"
      />
      <line
        opacity="1"
        x1="0"
        x2={props.innerWidth}
        y1={props.innerHeight}
        y2={props.innerHeight}
        stroke={grid.line.stroke}
        strokeWidth="1"
      />
    </g>
  );
};

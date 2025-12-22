import { Text } from "@nivo/text";
import { useTheme } from "@nivo/theming";
import type { NodeProps } from "@nivo/treemap";
import { animated, to } from "@react-spring/web";

export const TreeMapNodeComponent = <Datum extends object>({
  node,
  animatedProps,
  borderWidth,
  enableLabel,
  enableParentLabel,
  labelSkipSize,
}: NodeProps<Datum>) => {
  const theme = useTheme();

  const showLabel =
    enableLabel && node.isLeaf && (labelSkipSize === 0 || Math.min(node.width, node.height) > labelSkipSize);

  const showParentLabel = enableParentLabel && node.isParent;

  return (
    <animated.g
      transform={to([animatedProps.x, animatedProps.y], (x, y) => `translate(${x as number},${y as number})`)}
    >
      <animated.rect
        data-testid={`node.${node.id}`}
        width={to(animatedProps.width, (v) => Math.max(v, 0))}
        height={to(animatedProps.height, (v) => Math.max(v, 0))}
        fill={node.fill ? node.fill : animatedProps.color}
        strokeWidth={borderWidth}
        stroke={node.borderColor}
        fillOpacity={node.opacity}
        onMouseEnter={node.onMouseEnter}
        onMouseMove={node.onMouseMove}
        onMouseLeave={node.onMouseLeave}
        onClick={node.onClick}
        rx={6}
        ry={6}
      />
      {showLabel && (
        <Text
          data-testid={`label.${node.id}`}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            ...theme.labels.text,
            fill: node.labelTextColor,
            pointerEvents: "none",
          }}
          fillOpacity={animatedProps.labelOpacity}
          transform={to(
            [animatedProps.labelX, animatedProps.labelY, animatedProps.labelRotation],
            (x, y, rotation) => `translate(${x as number},${y as number}) rotate(${rotation as number})`,
          )}
        >
          {node.label}
        </Text>
      )}
      {showParentLabel && (
        <Text
          data-testid={`parentLabel.${node.id}`}
          dominantBaseline="central"
          style={{
            ...theme.labels.text,
            fill: node.parentLabelTextColor,
            pointerEvents: "none",
          }}
          fillOpacity={animatedProps.parentLabelOpacity}
          transform={to(
            [animatedProps.parentLabelX, animatedProps.parentLabelY, animatedProps.parentLabelRotation],
            (x, y, rotation) => `translate(${x as number},${y as number}) rotate(${rotation as number})`,
          )}
        >
          {node.parentLabel}
        </Text>
      )}
    </animated.g>
  );
};

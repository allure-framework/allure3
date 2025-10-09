import type { FunctionalComponent } from "preact";
import { Widget } from "../../Widget/index.js";
import { HeatMap } from "../HeatMap/index.js";
import type { HeatMapWidgetProps } from "./types.js";

export const HeatMapWidget: FunctionalComponent<HeatMapWidgetProps> = ({
  title,
  translations,
  rootAriaLabel,
  width,
  height,
  data,
  ...restProps
}) => {
  const emptyLabel = translations["no-results"];

  return (
    <Widget title={title}>
      <HeatMap
        data={data}
        width={width}
        height={height}
        emptyLabel={emptyLabel}
        emptyAriaLabel={emptyLabel}
        rootAriaLabel={rootAriaLabel}
        {...restProps}
      />
    </Widget>
  );
};



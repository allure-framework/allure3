import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "preact/hooks";
import { Grid } from "@allurereport/web-components";

const meta: Meta<typeof Grid> = {
  title: "Commons/Grid",
  component: Grid,
};

export default meta;

/**
 * Default story demonstrating a uniform widget layout.
 */
export const Default: StoryFn<typeof Grid> = (args) => {
  const [widgets, setWidgets] = useState<string[]>([
    "Widget 1",
    "Widget 2",
    "Widget 3",
    "Widget 4",
  ]);

  return (
    <Grid
      {...args}
      options={{
        onEnd: (event) => {
          const { oldIndex, newIndex } = event;

          if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
            const newWidgets = [...widgets];
            const [moved] = newWidgets.splice(oldIndex, 1);
            newWidgets.splice(newIndex, 0, moved);
            setWidgets(newWidgets);
          }
        },
      }}
    >
      {widgets.map((widget, index) => (
        <div
          key={index}
          style={{
            padding: "8px",
            border: "1px solid #ccc",
            backgroundColor: "#f9f9f9",
          }}
        >
          {widget}
        </div>
      ))}
    </Grid>
  );
};

/**
 * Story demonstrating widget reordering with varying widget sizes.
 */
export const SizeVariations: StoryFn<typeof Grid> = (args) => {
  type Widget = { id: string; label: string; size: "small" | "medium" | "big" };

  const [widgets, setWidgets] = useState<Widget[]>([
    { id: "1", label: "Small Widget", size: "small" },
    { id: "2", label: "Medium Widget", size: "medium" },
    { id: "3", label: "Big Widget", size: "big" },
    { id: "4", label: "Small Widget 2", size: "small" },
    { id: "5", label: "Medium Widget 2", size: "medium" },
    { id: "6", label: "Big Widget 2", size: "big" },
  ]);

  const widgetSizeStyles = {
    small: {
      padding: "4px",
      border: "1px solid #ccc",
      backgroundColor: "#e0e0e0",
      fontSize: "12px",
    },
    medium: {
      padding: "8px",
      border: "1px solid #ccc",
      backgroundColor: "#d0d0d0",
      fontSize: "16px",
    },
    big: {
      padding: "16px",
      border: "1px solid #ccc",
      backgroundColor: "#c0c0c0",
      fontSize: "20px",
    },
  };

  return (
    <Grid
      {...args}
      options={{
        onEnd: (event) => {
          const { oldIndex, newIndex } = event;

          if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
            const newWidgets = [...widgets];
            const [moved] = newWidgets.splice(oldIndex, 1);
            newWidgets.splice(newIndex, 0, moved);
            setWidgets(newWidgets);
          }
        },
      }}
    >
      {widgets.map((widget) => (
        <div key={widget.id} style={widgetSizeStyles[widget.size]}>
          {widget.label}
        </div>
      ))}
    </Grid>
  );
};

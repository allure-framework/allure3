import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "preact/hooks";
import { Grid, GridItem } from "@allurereport/web-components";

const meta: Meta<typeof Grid> = {
  title: "Commons/Grid",
  component: Grid,
};

export default meta;

/**
 * Default story demonstrating a uniform widget layout with drag-and-drop functionality.
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
        <GridItem
          key={index}
          style={{
            border: "1px solid #ccc",
            backgroundColor: "#f9f9f9",
            padding: "4px 0 4px 4px",
          }}
        >
          {widget}
        </GridItem>
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
      fontSize: "12px",
      backgroundColor: "#e0e0e0",
      padding: "4px 0 4px 4px",
    },
    medium: {
      fontSize: "16px",
      backgroundColor: "#d0d0d0",
      padding: "6px 0 4px 4px",
    },
    big: {
      fontSize: "20px",
      backgroundColor: "#c0c0c0",
      padding: "8px 0 4px 4px",
    },
  };

  const widgetSizePadding = {
    small: "4px 0",
    medium: "8px 0",
    big: "16px 0",
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
        <GridItem
          key={widget.id}
          style={{
            border: "1px solid #ccc",
            ...widgetSizeStyles[widget.size],
          }}
        >
          <span style={{ padding: widgetSizePadding[widget.size] }}>{widget.label}</span>
        </GridItem>
      ))}
    </Grid>
  );
};

/**
 * Story demonstrating grid usage for widget layout with disabled items.
 */
export const WithDisabledItems: StoryFn<typeof Grid> = (args) => {
  return (
    <Grid {...args} className="gridLayout">
      <style>{`
        .gridLayout {
          display: grid;
          grid-template-columns: repeat(3, minmax(150px, 1fr));
          gap: 1rem;
        }
      `}</style>
      {Array.from({ length: 9 }, (_, index) => (
        <GridItem
          key={index}
          isDndDisabled={index % 3 === 0}
          style={{
            border: "1px solid #ccc",
            backgroundColor: "#f0f0f0",
            padding: "4px 0 4px 4px",
          }}
        >
          Grid Item {index + 1}
          {index % 3 === 0 && " (Disabled DnD)"}
        </GridItem>
      ))}
    </Grid>
  );
};

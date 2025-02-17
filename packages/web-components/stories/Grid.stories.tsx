import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "preact/hooks";
import { Grid, GridItem } from "@allurereport/web-components";
import type { SortableEvent } from "sortablejs";

const meta: Meta<typeof Grid> = {
  title: "Commons/Grid",
  component: Grid,
};

export default meta;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(150px, 1fr))",
  gap: "1rem",
};

const listStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  maxWidth: "400px",
};

const defaultItemStyle = {
  border: "1px solid #ccc",
  backgroundColor: "#f9f9f9",
  padding: "4px 0 4px 4px",
};

const handleGridSort = <T,>(items: T[], event: SortableEvent): T[] => {
  const { oldIndex, newIndex } = event;

  if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
    const newItems = [...items];
    const [moved] = newItems.splice(oldIndex, 1);
    newItems.splice(newIndex, 0, moved);
    return newItems;
  }

  return items;
};

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
      style={listStyle}
      options={{
        onEnd: (event) => setWidgets(handleGridSort(widgets, event)),
      }}
    >
      {widgets.map((widget, index) => (
        <GridItem key={index} style={defaultItemStyle}>
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
      ...defaultItemStyle,
      fontSize: "12px",
      backgroundColor: "#e0e0e0",
    },
    medium: {
      ...defaultItemStyle,
      fontSize: "16px",
      backgroundColor: "#d0d0d0",
    },
    big: {
      ...defaultItemStyle,
      fontSize: "20px",
      backgroundColor: "#c0c0c0",
    },
  };

  return (
    <Grid
      {...args}
      style={listStyle}
      options={{
        onEnd: (event) => setWidgets(handleGridSort(widgets, event)),
      }}
    >
      {widgets.map((widget) => (
        <GridItem key={widget.id} style={widgetSizeStyles[widget.size]}>
          {widget.label}
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
    <Grid {...args} style={gridStyle}>
      {Array.from({ length: 9 }, (_, index) => (
        <GridItem
          key={index}
          isDndDisabled={index % 3 === 0}
          style={defaultItemStyle}
        >
          Grid Item {index + 1}
          {index % 3 === 0 && " (Disabled DnD)"}
        </GridItem>
      ))}
    </Grid>
  );
};

/**
 * Story demonstrating grid usage with swap mode enabled.
 */
export const WithSwapMode: StoryFn<typeof Grid> = (args) => {
  return (
    <Grid {...args} kind="swap" style={gridStyle}>
      {Array.from({ length: 9 }, (_, index) => (
        <GridItem
          key={index}
          isDndDisabled={index % 3 === 0}
          style={defaultItemStyle}
        >
          Grid Item {index + 1}
          {index % 3 === 0 && " (Disabled DnD)"}
        </GridItem>
      ))}
    </Grid>
  );
};

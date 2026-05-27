// Define the Nivo theme object using CSS variables
export const nivoTheme = {
  background: "var(--color-bg-primary)", // Chart background
  axis: {
    ticks: {
      // axis ticks (values on the axis)
      text: {
        fill: "var(--color-text-secondary)",
      },
    },
    legend: {
      // legend text (axis title)
      text: {
        fill: "var(--color-text-primary)",
      },
    },
    grid: {
      // grid lines
      line: {
        stroke: "var(--color-border-default)",
      },
    },
  },
  legends: {
    // Symbol legends text (e.g., below the chart)
    text: {
      fill: "var(--color-text-secondary)",
    },
  },
  tooltip: {
    container: {
      background: "var(--color-bg-raised)",
      color: "var(--color-text-primary)",
    },
  },
};

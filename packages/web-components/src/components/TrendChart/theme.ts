// Define the Nivo theme object using CSS variables
export const nivoTheme = {
  background: "var(--bg-base-primary)", // Chart background
  axis: {
    ticks: { // axis ticks (values on the axis)
      text: {
        fill: "var(--on-text-secondary)",
      },
    },
    legend: { // legend text (axis title)
      text: {
        fill: "var(--on-text-primary)",
      },
    },
    grid: { // grid lines
      line: {
        stroke: "var(--on-border-muted)",
      },
    },
  },
  legends: { // Symbol legends text (e.g., below the chart)
    text: {
      fill: "var(--on-text-secondary)",
    },
  },
  tooltip: {
    container: {
      background: "var(--bg-base-modal)",
      color: "var(--on-text-primary)",
    },
  },
};

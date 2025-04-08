// Define the Nivo theme object using CSS variables
export const nivoTheme = {
  axis: {
    ticks: { // axis ticks (values on the axis)
      text: {
        fill: "var(--on-text-secondary)",
      },
    },
    legend: { // legend text
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
};

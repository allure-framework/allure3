import type { TreeMapChartNode } from "@/components/Charts/TreeMapChart/types";

// Mock data for TreeChart showing features and their success rates
export const createTreeMapData = (): TreeMapChartNode => {
  const rootChildren = [
    {
      id: "epic-1",
      children: [
        {
          id: "feature-1",
          children: [
            {
              id: "user-story-1",
              value: 10,
              colorValue: 0.1,
            },
            {
              id: "user-story-2",
              value: 20,
              colorValue: 0.2,
            },
          ],
        },
        {
          id: "feature-2",
          children: [
            {
              id: "user-story-1",
              value: 40,
              colorValue: 0.4,
            },
          ],
        },
        {
          id: "feature-3",
          children: [
            {
              id: "user-story-1",
              value: 55,
              colorValue: 0.55,
            },
          ],
        },
      ],
    },
    {
      id: "epic-2",
      children: [
        {
          id: "feature-1",
          children: [
            {
              id: "user-story-1",
              value: 80,
              colorValue: 0.8,
            },
          ],
        },
        {
          id: "feature-2",
          children: [
            {
              id: "user-story-1",
              value: 20,
              colorValue: 0.2,
            },
          ],
        },
        {
          id: "feature-3",
          children: [
            {
              id: "user-story-1",
              value: 100,
              colorValue: 1.0,
            },
          ],
        },
      ],
    },
    {
      id: "epic-3",
      children: [
        {
          id: "feature-1",
          children: [
            {
              id: "user-story-1",
              value: 70,
              colorValue: 0.7,
            },
          ],
        },
        {
          id: "feature-2",
          children: [
            {
              id: "user-story-1",
              value: 50,
              colorValue: 0.5,
            },
          ],
        },
      ],
    },
    {
      id: "epic-4",
      children: [
        {
          id: "feature-1",
          children: [
            {
              id: "user-story-1",
              value: 50,
              colorValue: 0.5,
            },
          ],
        },
        {
          id: "feature-2",
          children: [
            {
              id: "user-story-1",
              value: 30,
              colorValue: 0.3,
            },
          ],
        },
      ],
    },
  ];

  return {
    id: "root",
    children: rootChildren,
  };
};

export const treeMapColors = {
  success: "#4caf50", // Green for high success rate
  warning: "#ff9800", // Orange for medium success rate
  error: "#f44336", // Red for low success rate
};

export const getColor = (successRate: number) => {
  if (successRate >= 0.8) {
    return treeMapColors.success;
  } else if (successRate >= 0.5) {
    return treeMapColors.warning;
  }

  return treeMapColors.error;
};

// Color function that works with domain for gradient
export const getColorWithDomain = (value: number, domain = [0, 0.5, 1]) => {
  if (value <= domain[0]) {
    return treeMapColors.error;
  } else if (value <= domain[1]) {
    return treeMapColors.warning;
  }

  return treeMapColors.success;
};

export const createEmptyTreeMapData = (): TreeMapChartNode => ({ id: "root", children: [] });

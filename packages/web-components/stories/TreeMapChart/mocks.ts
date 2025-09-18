import type { TreeMapChartNode } from "@allurereport/web-components";

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
            },
            {
              id: "user-story-2",
              value: 20,
            },
          ],
        },
        {
          id: "feature-2",
          children: [
            {
              id: "user-story-1",
              value: 40,
            },
          ]
        },
        {
          id: "feature-3",
          children: [
            {
              id: "user-story-1",
              value: 55,
            },
          ]
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
            },
          ]
        },
        {
          id: "feature-2",
          children: [
            {
              id: "user-story-1",
              value: 20,
            },
          ]
        },
        {
          id: "feature-3",
          children: [
            {
              id: "user-story-1",
              value: 100,
            },
          ]
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
            },
          ]
        },
        {
          id: "feature-2",
          children: [
            {
              id: "user-story-1",
              value: 50,
            },
          ]
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
            },
          ]
        },
        {
          id: "feature-2",
          children: [
            {
              id: "user-story-1",
              value: 30,
            },
          ]
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
  error: "#f44336",   // Red for low success rate
};

export const getColor = (node: TreeMapChartNode) => {
  const successRate = node.value;
  console.log("node", node);

  if (successRate >= 100) {
     return treeMapColors.success;
  } else if (successRate >= 50) {
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
  } else {
    return treeMapColors.success;
  }
};

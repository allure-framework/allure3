import type { HeatMapProps } from "@/components/Charts/HeatMap/types";

const envCount = 3;
const featCount = 10;

const createMockItem = (id: string, count: number) => {
  return {
    id,
    data: Array.from({ length: count }, (_, index) => ({ x: `feat ${index + 1}`, y: Math.floor(Math.random() * count) + 1 })),
  };
};

const createMockData = (countRows: number, countColumns: number) => {
  return Array.from({ length: countRows }, (_, index) => createMockItem(`env ${index + 1}`, countColumns));
};

export const mockData: HeatMapProps["data"] = createMockData(envCount, featCount);

import { type FunctionalComponent, createContext } from "preact";
import type { Dispatch, StateUpdater } from "preact/hooks";
import { useContext, useState } from "preact/hooks";

type BarChartState = string | undefined;

const BarChartStateContext = createContext<[BarChartState, Dispatch<StateUpdater<BarChartState>>] | null>(null);

export const BarChartStateProvider: FunctionalComponent = (props) => {
  const { children } = props;
  const [hoveredState, setHoveredState] = useState<string | undefined>(undefined);

  return (
    <BarChartStateContext.Provider value={[hoveredState, setHoveredState]}>{children}</BarChartStateContext.Provider>
  );
};

export const useBarChartState = () => {
  const context = useContext(BarChartStateContext);

  if (!context) {
    throw new Error("useBarChartState must be used within a BarChartStateProvider");
  }

  return context;
};

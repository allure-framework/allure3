import type { FunctionalComponent } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

const WidthContext = createContext<number | null>(null);

export const useWidth = () => {
  const width = useContext(WidthContext);

  if (!width) {
    throw new Error("useWidth must be used within a ResponsiveWrapper");
  }
  return width;
};

export type Dimensions = {
  width: number;
  height: number;
};

export const WidthProvider: FunctionalComponent<{ width: number }> = (props) => {
  const { children, width } = props;

  return <WidthContext.Provider value={width}>{children}</WidthContext.Provider>;
};

import { type ComponentChildren, createContext } from "preact";
import { useContext } from "preact/hooks";
import { DimensionsProvider } from "@/components/DimensionsProvider";
import styles from "./styles.scss";

type Dimensions = {
  readonly width: number;
  readonly height: number;
};

const DimensionsContext = createContext<Dimensions>({
  width: 0,
  height: 0,
});

export const useDimensions = () => {
  return useContext(DimensionsContext);
};

export const Wrapper = (props: { children: ComponentChildren }) => {
  return (
    <DimensionsProvider
      children={(width, height) => (
        <DimensionsContext.Provider value={{ width, height }}>
          <div className={styles.wrapper}>{props.children}</div>
        </DimensionsContext.Provider>
      )}
    />
  );
};

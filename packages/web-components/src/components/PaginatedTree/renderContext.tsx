import type { ComponentChild } from "preact";
import { createContext } from "preact";
import type { PropsWithChildren } from "preact/compat";
import { useContext } from "preact/compat";
import type { TreeGroup, TreeLeaf } from "./model";

type RenderContextProps<T extends Record<string, any>> = {
  renderLeaf: (props: TreeLeaf<T>) => ComponentChild;
  renderGroup: (props: TreeGroup<T>) => ComponentChild;
  onGroupClick: (group: TreeGroup<T>) => void;
  onGroupKeyDown: (group: TreeGroup<T>, key: "ArrowRight" | "ArrowLeft", event: KeyboardEvent) => void;
  onLeafClick: (leaf: TreeLeaf<T>) => void;
};

const RenderContext = createContext<RenderContextProps<any>>({
  renderLeaf: () => null,
  renderGroup: () => null,
  onGroupClick: () => {},
  onGroupKeyDown: () => {},
  onLeafClick: () => {},
});

export const RenderContextProvider = <T extends Record<string, any>>({ children, ...props }: PropsWithChildren<RenderContextProps<T>>) => (
  <RenderContext.Provider value={props}>{children}</RenderContext.Provider>
);

export const useRenderContext = <T extends Record<string, any>>() => {
  return useContext(RenderContext) as RenderContextProps<T>;
};

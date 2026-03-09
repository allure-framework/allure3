import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

export type TreeI18nKeys = "tooltip.flaky" | "tooltip.retries" | "tooltip.transition";

export type TreeI18nProp = (key: TreeI18nKeys, options?: Record<string, string>) => string | undefined;
const noopI18n = () => undefined;
const TreeI18nContext = createContext<TreeI18nProp>(noopI18n);

export const TreeI18nProvider = (props: { children: ComponentChildren; i18n?: TreeI18nProp }) => {
  const { children, i18n } = props;

  return <TreeI18nContext.Provider value={i18n ?? noopI18n}>{children}</TreeI18nContext.Provider>;
};

export const useTreeI18n = () => {
  return useContext(TreeI18nContext);
};

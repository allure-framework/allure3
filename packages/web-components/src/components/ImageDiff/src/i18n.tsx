import type { ComponentChild } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

export type I18nKeys =
  | "mode.diff"
  | "mode.actual"
  | "mode.expected"
  | "mode.side-by-side"
  | "mode.overlay"
  | "empty.failed-to-load"
  | "image.diff"
  | "image.actual"
  | "image.expected";

export type I18nProp = (key: I18nKeys, props?: Record<string, unknown>) => string | undefined;

const I18nContext = createContext<I18nProp>(() => undefined);

const noopI18n = () => undefined;

export const I18nProvider = (props: { children: ComponentChild; i18n?: I18nProp }) => {
  const { children, i18n } = props;

  return <I18nContext.Provider value={i18n ?? (noopI18n as I18nProp)}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  return useContext(I18nContext);
};

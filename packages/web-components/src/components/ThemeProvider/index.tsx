import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

const ThemeContext = createContext<string>("light");

export const useTheme = () => {
  return useContext(ThemeContext) ?? "light";
};

export const ThemeProvider = (props: { children: ComponentChildren; theme: string }) => {
  const { children, theme } = props;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

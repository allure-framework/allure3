import { IconButton } from "@/components/Button";
import { allureIcons } from "@/components/SvgIcon";
import { useEffect } from "preact/hooks";

export type Theme = "light" | "dark";

export interface ThemeButtonProps {
  theme: Theme;
  getTheme: () => void;
  toggleTheme: () => void;
}

export const ThemeButton = ({ theme, toggleTheme, getTheme }: ThemeButtonProps) => {
  useEffect(() => {
    getTheme();
  }, [getTheme]);

  return (
    <IconButton
      onClick={toggleTheme}
      style="ghost"
      icon={theme === "light" ? allureIcons.lineShapesMoon : allureIcons.lineShapesSun}
      size="s"
    />
  );
};

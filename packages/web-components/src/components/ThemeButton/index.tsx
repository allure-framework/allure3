import { useEffect } from "preact/hooks";
import { IconButton } from "@/components/Button";
import { allureIcons } from "@/components/SvgIcon";

export type Theme = "light" | "dark" | "auto";

export interface ThemeButtonProps {
  theme: Theme;
  getTheme: () => void;
  toggleTheme: () => void;
}

export const ThemeButton = ({ theme, toggleTheme, getTheme }: ThemeButtonProps) => {
  useEffect(() => {
    getTheme();
  }, [getTheme]);

  const icons: Record<Theme, string> = {
    light: allureIcons.lineShapesSun,
    dark: allureIcons.lineShapesMoon,
    auto: allureIcons.lineShapesThemeAuto,
  };

  return <IconButton onClick={toggleTheme} style="ghost" icon={icons[theme]} size="s" />;
};

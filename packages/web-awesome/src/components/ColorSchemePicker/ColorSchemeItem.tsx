import type { ThemeFamilyOption } from "@/stores/colorScheme";

interface ColorSchemeItemProps {
  option: ThemeFamilyOption;
}

export const ColorSchemeItem = ({ option }: ColorSchemeItemProps) => <span>{option.label}</span>;

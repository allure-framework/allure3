import { SvgIcon, allureIcons } from "@/components/SvgIcon";

const icons = {
  flaky: allureIcons.lineIconBomb2,
  new: allureIcons.lineGeneralEye,
};

export interface TreeItemMetaIconProps {
  type: "flaky" | "new";
}

export const TreeItemMetaIcon = ({ type }: TreeItemMetaIconProps) => (
  <SvgIcon data-testid={`tree-item-meta-icon-${type}`} id={icons[type]} />
);

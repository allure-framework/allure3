import TooltipView from "@/components/tooltip/TooltipView.js";
import { className } from "@/decorators/index.js";
import "./styles.scss";

@className("popover")
class PopoverView extends TooltipView {}

export default PopoverView;

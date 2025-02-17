import type { FunctionComponent } from "preact";

export interface DragHandleIconProps {
  className?: string;
}

export const DragHandleIcon: FunctionComponent<DragHandleIconProps> = ({ className }) => {
  return (
    <svg
      width="12"
      height="8"
      viewBox="0 0 12 8"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="3" cy="2" r="1" />
      <circle cx="6" cy="2" r="1" />
      <circle cx="9" cy="2" r="1" />
      <circle cx="3" cy="6" r="1" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="9" cy="6" r="1" />
    </svg>
  );
};

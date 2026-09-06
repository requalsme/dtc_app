import * as React from "react";
export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  selected?: boolean;
  onRemove?: () => void;
  icon?: React.ReactNode;
}
export declare function Chip(props: ChipProps): JSX.Element;

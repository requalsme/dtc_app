import * as React from "react";
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: React.ReactNode;
  /** Second line under the label, muted. */
  description?: string;
  /** lg (26px) for care-plan task lists tapped in the field. */
  size?: "md" | "lg";
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;

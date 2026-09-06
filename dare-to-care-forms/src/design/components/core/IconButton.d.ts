import * as React from "react";
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  /** Required — becomes aria-label and the tooltip. */
  label: string;
  variant?: "ghost" | "outline" | "subtle" | "solid";
  size?: "sm" | "md" | "lg";
}
export declare function IconButton(props: IconButtonProps): JSX.Element;

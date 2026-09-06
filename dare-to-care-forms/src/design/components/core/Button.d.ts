import * as React from "react";
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = dark forest fill; secondary = pale mint with a mint hairline; outline/ghost/danger are hairline-only. */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "solid_danger";
  size?: "sm" | "md" | "lg";
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}
export declare function Button(props: ButtonProps): JSX.Element;

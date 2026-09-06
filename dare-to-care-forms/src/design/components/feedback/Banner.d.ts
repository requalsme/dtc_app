import * as React from "react";
export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "info" | "success" | "warning" | "error";
  icon?: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
}
export declare function Banner(props: BannerProps): JSX.Element;

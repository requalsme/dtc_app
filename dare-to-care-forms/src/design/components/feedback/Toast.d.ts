import * as React from "react";
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "success" | "error";
  icon?: React.ReactNode;
}
export declare function Toast(props: ToastProps): JSX.Element;

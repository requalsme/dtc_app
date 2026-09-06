import * as React from "react";
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
}
export declare function Switch(props: SwitchProps): JSX.Element;

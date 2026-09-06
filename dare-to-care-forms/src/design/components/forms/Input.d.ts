import * as React from "react";
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** One line of helper text below the field. */
  hint?: string;
  /** Replaces hint and turns the border cool cranberry. */
  error?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}
export declare function Input(props: InputProps): JSX.Element;

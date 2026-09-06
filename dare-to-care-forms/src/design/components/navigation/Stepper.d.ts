import * as React from "react";
export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section labels, or {label} objects — matches the form schema's section list. */
  steps: Array<string | { label: string }>;
  current?: number;
  onSelect?: (index: number) => void;
  orientation?: "vertical" | "horizontal";
}
export declare function Stepper(props: StepperProps): JSX.Element;

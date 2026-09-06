import * as React from "react";
export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  title?: string;
  description?: string;
  /** Shown in a pale-mint rounded square above the title. */
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  width?: number;
}
export declare function Dialog(props: DialogProps): JSX.Element;

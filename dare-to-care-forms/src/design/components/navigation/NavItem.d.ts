import * as React from "react";
export interface NavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  label: string;
  /** Pale mint fill, dark forest text, 3px green leading bar. */
  active?: boolean;
  /** Pending count — cranberry stamp, matching the application's nav badges. */
  badge?: number | string;
  /** Draws the outbound arrow used for Training Courses. */
  external?: boolean;
  collapsed?: boolean;
}
export declare function NavItem(props: NavItemProps): JSX.Element;

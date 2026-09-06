import * as React from "react";
export interface RoleTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** admin | office | caregiver | new-hire | client — drives the edge colour. */
  role: "admin" | "office" | "caregiver" | "new-hire" | "client";
  title: string;
  summary?: string;
  /** Small mono line, e.g. the demo credential. */
  hint?: string;
  selected?: boolean;
}
export declare function RoleTile(props: RoleTileProps): JSX.Element;

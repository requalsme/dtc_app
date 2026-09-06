import * as React from "react";
export interface SignatureValue { dataUrl: string; signedBy?: string; at: string }
export interface SignaturePadProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  /** Name recorded with the signature. */
  signedBy?: string;
  onChange?: (value: SignatureValue | null) => void;
  invalid?: boolean;
  height?: number;
}
export declare function SignaturePad(props: SignaturePadProps): JSX.Element;

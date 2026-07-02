"use client";

import type { CSSProperties, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./Button";

// Form submit button that reflects the enclosing <form>'s pending state via
// useFormStatus (must render inside the form). Disables + swaps to pendingLabel
// while the server action is in flight.
export function SubmitButton({
  children,
  pendingLabel,
  style,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  style?: CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} style={style}>
      {pending ? pendingLabel ?? children : children}
    </Button>
  );
}

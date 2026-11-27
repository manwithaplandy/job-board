"use client";

// What a view frame (ViewFrame) hands the renderer inside it (spec 08 S5). In this PR it
// is only where a sandbox frame puts its chip region: the frame's `rf-view__requests`
// element. A renderer with no provider (a frame rendered alone, as in its unit tests)
// keeps its chip region inline.
import { createContext } from "react";

export type ViewHost = {
  /** Where SandboxFrame portals its chip region; null until the frame has mounted it. */
  requestsEl: HTMLElement | null;
};

export const ViewHostContext = createContext<ViewHost | null>(null);

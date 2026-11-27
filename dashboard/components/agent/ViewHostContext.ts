"use client";

// What a view frame (ViewFrame) hands the renderer inside it (spec 08 S5). Its presence
// means the renderer is inside a frame: the frame's h3 is then the view's only title, so
// BlockList and TreeRenderer leave out their own (spec 08 S5, S13). Its value is where a
// sandbox frame puts its chip region: the frame's `rf-view__requests` element. A renderer
// with no provider (rendered alone, as in its unit tests and the gallery fixtures) keeps
// its own title and its chip region inline.
import { createContext } from "react";

export type ViewHost = {
  /** Where SandboxFrame portals its chip region; null until the frame has mounted it. */
  requestsEl: HTMLElement | null;
};

export const ViewHostContext = createContext<ViewHost | null>(null);

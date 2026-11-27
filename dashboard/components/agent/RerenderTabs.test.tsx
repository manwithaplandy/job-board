// "Re-render as" (plan Task 2.9). The tabs and buttons render inside the view frame since
// PR 2 (spec 08 S8); their behaviour is tested in ViewFrame.test.tsx. Here: the tab labels.
import { expect, test } from "vitest";
import type { HostSurface } from "@/lib/agent/surfaces/host";
import { versionLabels } from "./RerenderTabs";

const v = (variant: 1 | 2 | 3) => ({ variant }) as Pick<HostSurface, "variant">;

test("tabs read Original, then each re-render's variant, numbered when a variant repeats", () => {
  expect(versionLabels([v(1), v(2), v(3), v(2)])).toEqual(["Original", "Layout", "Code", "Layout 2"]);
  expect(versionLabels([v(2)])).toEqual(["Original"]);
});

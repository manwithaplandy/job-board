"use client";
import { SegmentedControl } from "@/components/ui/Navigation";
import { useTheme } from "./ThemeProvider";
import type { ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function AppearanceToggle() {
  const { choice, setChoice } = useTheme();

  return (
    <SegmentedControl
      label="Theme"
      items={OPTIONS}
      value={choice}
      onChange={(value) => setChoice(value as ThemeChoice)}
      className="appearance-toggle"
    />
  );
}

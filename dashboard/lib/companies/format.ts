// Rolefit visual tokens for company verdicts (greens/greys to match the board).
export function verdictMeta(verdict: string): { label: string; color: string; bg: string } {
  switch (verdict) {
    case "include":
      return { label: "Included", color: "#2f7d54", bg: "#e8f6ee" };
    case "exclude":
      return { label: "Excluded", color: "#b4471f", bg: "#fdece4" };
    default:
      return { label: "Unknown", color: "#8a93a3", bg: "#eef1f5" };
  }
}

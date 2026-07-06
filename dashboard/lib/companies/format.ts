// Rolefit visual tokens for company verdicts (greens/greys to match the board).
export function verdictMeta(verdict: string): { label: string; color: string; bg: string } {
  switch (verdict) {
    case "include":
      return { label: "Included", color: "var(--success)", bg: "var(--success-bg)" };
    case "exclude":
      return { label: "Excluded", color: "var(--danger)", bg: "var(--danger-bg)" };
    default:
      return { label: "Unknown", color: "var(--text-muted)", bg: "var(--bg-muted)" };
  }
}

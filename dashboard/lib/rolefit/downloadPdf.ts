// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function downloadPdf(
  filename: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: (doc: any) => void,
  fallbackText?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let JsPDF: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsPDFMod = (await import("jspdf")) as any;
    JsPDF = jsPDFMod.jsPDF ?? jsPDFMod.default;
  } catch (e) {
    console.error("Failed to import jsPDF; falling back to .txt download", e);
    if (fallbackText != null) {
      const blob = new Blob([fallbackText], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename.replace(/\.pdf$/i, ".txt");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    }
    return;
  }
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  render(doc);
  doc.save(filename);
}

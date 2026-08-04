// Client-side PDF export.
//
// Captures a rendered DOM element (the on-screen document "sheet") and saves it
// as a multi-page A4 PDF. Because it snapshots the real rendered HTML, whatever
// text is shown — including full policy/acknowledgement body text, the user's
// entries, and the signature image — appears verbatim in the PDF.
//
// jsPDF and html2canvas are imported dynamically so they only load when a user
// actually exports a PDF (keeps the initial bundle small).

// Renders the element to a jsPDF document. Shared by the manual "download a
// copy" button and by the automatic filing pipeline, so the file a user
// downloads and the file kept on the client's/staff member's record are
// byte-for-byte the same document.
async function renderElementToPdf(el: HTMLElement): Promise<any> {
  const [html2canvasMod, jspdfMod] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const html2canvas = (html2canvasMod as any).default || (html2canvasMod as any);
  const jsPDF = (jspdfMod as any).jsPDF || (jspdfMod as any).default;

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Scale the captured image to the page width, then slice it across pages.
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH, undefined, "FAST");
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH, undefined, "FAST");
    heightLeft -= pageH;
  }

  return pdf;
}

export async function downloadElementAsPdf(el: HTMLElement, filename: string): Promise<void> {
  const pdf = await renderElementToPdf(el);
  pdf.save(filename);
}

// Same render, returned as a Blob so it can be uploaded to Storage and filed
// against a client or staff member instead of (or as well as) downloaded.
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const pdf = await renderElementToPdf(el);
  return pdf.output("blob") as Blob;
}

export function safeFileName(name: string): string {
  return (name || "form").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
}

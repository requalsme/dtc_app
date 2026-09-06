// Fill and sign the REAL document, rather than generating a lookalike.
//
// WHY THIS EXISTS
// The app's normal filing path renders the on-screen form to a PDF with
// html2canvas — a picture of the app's own recreation of a form. That is fine
// for something the agency wrote itself. It is not fine for a state or federal
// document: an I-9 has to be an I-9, on USCIS's own page, with its form number
// and revision date intact. A recreation that "looks the same" is not the same
// document, and a surveyor is entitled to the real one.
//
// So for anything marked as a legal original, the answers are written into the
// actual PDF the agency supplied and the signature is stamped onto it. What
// gets filed is that document, signed.
//
// TWO SHAPES OF SOURCE, AND THEY NEED DIFFERENT TREATMENT
//
//   Fillable (AcroForm). The PDF carries named field boxes — the I-9 has 128 of
//   them. Values are written into those fields by name and the form is then
//   flattened, so what is stored is a fixed page rather than an editable form
//   somebody could still change.
//
//   Flat. Printed layout, no field boxes at all — which is 18 of the agency's
//   19 documents. There is nowhere to "set" a value, so anything to be printed
//   onto the page needs an explicit placement: page, x, y, size. Those are
//   stored on the template and are the only way text can land in the right
//   place on a page the app cannot introspect.
//
// Coordinates in placements are fractions of the page, matching what
// pdfExtract captures, so they survive a page being a different size than
// whoever placed them assumed.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface Placement {
  /** 0-based page index. */
  page: number;
  /** Fractions of page width/height, top-left origin (CSS-style). */
  x: number;
  y: number;
  /** Optional box; width is used to wrap text, height to fit a signature. */
  w?: number;
  h?: number;
  /** Points. Defaults to 10. */
  size?: number;
}

export interface FillOptions {
  /** The original document's bytes. */
  source: ArrayBuffer | Uint8Array;
  /** fieldId -> value, as captured by the app. */
  values: Record<string, any>;
  /** fieldId -> AcroForm field name, for a fillable source. */
  fieldMap?: Record<string, string>;
  /** fieldId -> where to print it, for a flat source. */
  placements?: Record<string, Placement>;
  /** fieldId -> PNG data URL of a drawn signature. */
  signatures?: Record<string, string>;
  /** Leave the form editable. Off by default: a filed record is not a draft. */
  keepEditable?: boolean;
}

export interface FillResult {
  blob: Blob;
  /** What actually landed, so the caller can report rather than assume. */
  filledFields: number;
  stampedSignatures: number;
  /** Values with nowhere to go. Never silently dropped. */
  unplaced: string[];
}

const asText = (v: any): string => {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (typeof v === "object") return "";
  return String(v);
};

/** Wrap to the placement's width so a long answer doesn't run off the page. */
function wrap(text: string, font: any, size: number, maxWidth: number): string[] {
  if (!maxWidth) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export async function fillRealDocument(opts: FillOptions): Promise<FillResult> {
  const { source, values, fieldMap = {}, placements = {}, signatures = {}, keepEditable = false } = opts;

  const pdf = await PDFDocument.load(source, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  let filledFields = 0;
  let stampedSignatures = 0;
  const unplaced: string[] = [];

  // ── 1. AcroForm fields, written by name ──────────────────────────────────
  let form: any = null;
  try { form = pdf.getForm(); } catch { form = null; }

  if (form) {
    for (const [fieldId, pdfName] of Object.entries(fieldMap)) {
      const text = asText(values[fieldId]);
      if (!text) continue;
      try {
        // Try the field kinds in order of likelihood; a name that is not a
        // text field is usually a checkbox or a dropdown.
        try {
          form.getTextField(pdfName).setText(text);
          filledFields++;
          continue;
        } catch { /* not a text field */ }

        try {
          const box = form.getCheckBox(pdfName);
          const truthy = /^(yes|true|on|checked|x|1)$/i.test(text);
          if (truthy) box.check(); else box.uncheck();
          filledFields++;
          continue;
        } catch { /* not a checkbox */ }

        try {
          form.getDropdown(pdfName).select(text);
          filledFields++;
          continue;
        } catch { /* not a dropdown */ }

        unplaced.push(fieldId);
      } catch {
        unplaced.push(fieldId);
      }
    }
  }

  // ── 2. Text printed onto a flat page ─────────────────────────────────────
  for (const [fieldId, place] of Object.entries(placements)) {
    const text = asText(values[fieldId]);
    if (!text) continue;
    const page = pages[place.page ?? 0];
    if (!page) { unplaced.push(fieldId); continue; }

    const { width, height } = page.getSize();
    const size = place.size ?? 10;
    const maxWidth = place.w ? place.w * width : 0;
    const lines = wrap(text, font, size, maxWidth);

    lines.forEach((line, i) => {
      page.drawText(line, {
        x: place.x * width,
        // Placements are top-left origin like CSS; PDF draws from bottom-left.
        y: height - place.y * height - size - i * (size * 1.25),
        size,
        font,
        color: rgb(0.09, 0.15, 0.12), // --gray-900, so print matches the screen
      });
    });
    filledFields++;
  }

  // ── 3. Signatures, stamped as images ─────────────────────────────────────
  for (const [fieldId, dataUrl] of Object.entries(signatures)) {
    if (!dataUrl) continue;
    const place = placements[fieldId];
    if (!place) { unplaced.push(fieldId); continue; }
    const page = pages[place.page ?? 0];
    if (!page) { unplaced.push(fieldId); continue; }

    try {
      const base64 = dataUrl.split(",")[1] || "";
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const png = await pdf.embedPng(bytes);
      const { width, height } = page.getSize();

      const boxW = (place.w ?? 0.22) * width;
      const boxH = (place.h ?? 0.05) * height;
      // Fit inside the box without distorting the handwriting — a stretched
      // signature is arguably not that person's signature.
      const scale = Math.min(boxW / png.width, boxH / png.height);

      page.drawImage(png, {
        x: place.x * width,
        y: height - place.y * height - png.height * scale,
        width: png.width * scale,
        height: png.height * scale,
      });
      stampedSignatures++;
    } catch {
      unplaced.push(fieldId);
    }
  }

  // Flattening turns filled fields into fixed page content. Without it the
  // stored document is still an editable form, which is not what "signed" means.
  if (form && !keepEditable) {
    try { form.flatten(); } catch { /* nothing to flatten */ }
  }

  const bytes = await pdf.save();
  return {
    // Copied into a plain ArrayBuffer: a Uint8Array view is not a BlobPart.
    blob: new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: "application/pdf" }),
    filledFields,
    stampedSignatures,
    unplaced,
  };
}

/**
 * Does this document carry its own field boxes?
 *
 * Decides which of the two treatments above a source needs, and is what the
 * import flow uses to tell an agency-authored form apart from a government one.
 */
export async function inspectSource(source: ArrayBuffer | Uint8Array): Promise<{
  readable: boolean;
  pages: number;
  acroFields: string[];
  error?: string;
}> {
  try {
    const pdf = await PDFDocument.load(source, { ignoreEncryption: true });
    let acroFields: string[] = [];
    try { acroFields = pdf.getForm().getFields().map((f: any) => f.getName()); } catch { acroFields = []; }
    return { readable: true, pages: pdf.getPageCount(), acroFields };
  } catch (err: any) {
    // A PDF that will not parse has to be reported, not swallowed. One of the
    // agency's own documents (Ihss Medication.pdf) is in exactly this state.
    return { readable: false, pages: 0, acroFields: [], error: err?.message || "This PDF could not be read." };
  }
}

// Real PDF import: reads an arbitrary PDF picked by an admin and turns it into
// an editable draft template schema (the same shape used by src/components/schemas.js).
//
// Two paths:
//  1. The PDF has real AcroForm fields (a "fillable" PDF) — each field is mapped
//     to a matching form-builder field type (text/textarea/checkbox/radio/select/signature),
//     grouped into one section per PDF page.
//  2. The PDF has no form fields (a flat/scanned document) — its text is extracted
//     page-by-page with pdfjs-dist so nothing is lost, shown as reference content,
//     plus an empty starter section the admin fills in using the existing field builder.
//
// Note: field-type detection uses `instanceof` against pdf-lib's exported classes,
// NOT `field.constructor.name` — production minification renames classes, which
// silently broke name-based matching (every field came back unrecognized and the
// resulting template had zero fields, even though pdf-lib had parsed them fine).

import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
  PDFSignature,
  type PDFField,
} from "pdf-lib";

export type ExtractProgressStep =
  | "reading"
  | "detecting-fields"
  | "extracting-text"
  | "building"
  | "done";

export type ExtractedSchema = {
  key: string;
  name: string;
  category: string;
  version: number;
  estMin: number;
  icon: string;
  description: string;
  subject: string;
  completedBy: string[];
  sections: any[];
  sourceFile: string;
  sourcePages: number;
  extractionMethod: "form-fields" | "text-only";
  extractedFieldCount: number;
};

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "field";
}

// AcroForm field names are often ugly/technical (e.g. "topmostSubform[0].Page1[0].ClientName[0]"
// or "client_name_1"). Take the last meaningful segment and humanize it.
function cleanLabel(rawName: string): string {
  const lastSegment = rawName.split(/[.[\]]+/).filter(Boolean).pop() || rawName;
  const spaced = lastSegment
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-zA-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  const words = spaced.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Field";
  return words.map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase())).join(" ");
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) { id = `${base}_${n}`; n += 1; }
  used.add(id);
  return id;
}

function mapAcroField(field: PDFField, used: Set<string>): any | null {
  const rawName = field.getName();
  const label = cleanLabel(rawName);
  const id = uniqueId(slugify(rawName), used);
  let required = false;
  try { required = typeof (field as any).isRequired === "function" ? (field as any).isRequired() : false; } catch { /* not all field types expose this reliably */ }

  if (field instanceof PDFTextField) {
    let multiline = false;
    try { multiline = field.isMultiline(); } catch { /* ignore */ }
    return { id, label, type: multiline ? "textarea" : "text", required };
  }
  if (field instanceof PDFCheckBox) {
    return { id, label, type: "checkbox", required, options: [{ label }] };
  }
  if (field instanceof PDFRadioGroup) {
    let opts: string[] = [];
    try { opts = field.getOptions(); } catch { /* ignore */ }
    if (opts.length === 0) return null;
    return { id, label, type: "radio", required, options: opts.map((o) => ({ label: o })) };
  }
  if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
    let opts: string[] = [];
    try { opts = field.getOptions(); } catch { /* ignore */ }
    if (opts.length === 0) return null;
    return { id, label, type: "select", required, options: opts.map((o) => ({ label: o })) };
  }
  if (field instanceof PDFSignature) {
    return { id, label, type: "signature", required };
  }
  return null; // push buttons and unrecognized field kinds aren't fillable inputs
}

function groupFieldsByPage(fields: PDFField[], pages: any[]): any[] {
  const used = new Set<string>();
  const byPage = new Map<number, any[]>();
  for (const field of fields) {
    const mapped = mapAcroField(field, used);
    if (!mapped) continue;
    let pageIndex = 0;
    try {
      const widgets = (field as any).acroField.getWidgets();
      const pRef = widgets[0]?.P?.();
      const idx = pages.findIndex((p) => p.ref === pRef);
      if (idx >= 0) pageIndex = idx;
    } catch { /* default to page 0 */ }
    if (!byPage.has(pageIndex)) byPage.set(pageIndex, []);
    byPage.get(pageIndex)!.push(mapped);
  }
  const sortedPageIndices = Array.from(byPage.keys()).sort((a, b) => a - b);
  return sortedPageIndices.map((idx) => ({
    id: `sec_p${idx + 1}`,
    title: sortedPageIndices.length > 1 ? `Page ${idx + 1}` : "Form fields",
    fields: byPage.get(idx),
  }));
}

async function extractPageText(bytes: Uint8Array): Promise<string[]> {
  const pdfjsLib: any = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ").replace(/\s+/g, " ").trim();
    pages.push(text);
  }
  return pages;
}

function buildTextFallbackSections(pagesText: string[]): any[] {
  const referenceSection = {
    id: "sec_reference",
    title: "Extracted reference text",
    fields: pagesText.map((text, i) => ({
      id: `ref_p${i + 1}`,
      type: "policyText",
      label: pagesText.length > 1 ? `Page ${i + 1} content` : "Source content",
      body: text || "No extractable text found on this page — it may be a scanned image. Add fields manually below.",
    })),
  };
  const starterSection = { id: "sec_custom", title: "Add your fields", fields: [] };
  return [referenceSection, starterSection];
}

export async function extractSchemaFromPdf(
  file: File,
  onProgress?: (step: ExtractProgressStep) => void
): Promise<ExtractedSchema> {
  onProgress?.("reading");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();

  onProgress?.("detecting-fields");
  let fields: PDFField[] = [];
  try {
    const form = pdfDoc.getForm();
    fields = form.getFields();
  } catch { /* no AcroForm at all */ }

  let sections: any[];
  let method: "form-fields" | "text-only";
  let extractedFieldCount = 0;

  if (fields.length > 0) {
    sections = groupFieldsByPage(fields, pdfDoc.getPages());
    extractedFieldCount = sections.reduce((n, s) => n + s.fields.length, 0);
    method = extractedFieldCount > 0 ? "form-fields" : "text-only";
  } else {
    method = "text-only";
  }

  if (method === "text-only") {
    onProgress?.("extracting-text");
    const pagesText = await extractPageText(bytes);
    sections = buildTextFallbackSections(pagesText);
  }

  onProgress?.("building");
  const baseName = file.name.replace(/\.pdf$/i, "").trim() || "Untitled form";
  const key = `custom_${slugify(baseName)}_${Date.now().toString(36)}`;

  const schema: ExtractedSchema = {
    key,
    name: baseName,
    category: "Custom",
    version: 1,
    estMin: Math.max(2, Math.ceil((extractedFieldCount || pageCount * 3) / 4)),
    icon: "file-text",
    description: `Imported from ${file.name}`,
    subject: "client",
    completedBy: ["caregiver", "officeManager", "admin"],
    sections: sections!,
    sourceFile: file.name,
    sourcePages: pageCount,
    extractionMethod: method,
    extractedFieldCount,
  };

  onProgress?.("done");
  return schema;
}

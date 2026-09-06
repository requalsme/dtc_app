// Infer form fields from a flat PDF's layout.
//
// WHY THIS EXISTS
// Only one of the agency's nineteen documents carries AcroForm field boxes —
// the federal I-9, because USCIS ships it that way. Every other form is a flat
// printed layout, and the importer previously gave up on those: it dumped each
// page's text as read-only reference content and handed the admin an empty
// section to build by hand. A form uploaded that way arrived with zero usable
// fields, which is why "upload a PDF and get a fillable form" did not really
// work for the documents this agency actually uses.
//
// But a flat page is not opaque. pdfjs reports every text run with a position,
// and a printed form is a highly regular thing: a label, a colon, and then
// deliberate empty space for someone to write in. That gap IS the field, and
// the distance to whatever comes next on the same line is how wide it should
// be. Reading that is far more useful than transcribing the page.
//
// WHAT THIS DELIBERATELY DOES NOT DO
// It does not guess at prose. Only text that looks like a form label — ends in
// a colon, or sits in a checkbox column — produces a field. Everything else is
// left as reference content. A wrong field is worse than a missing one: someone
// has to notice it and delete it, and if they do not, it becomes a question the
// form asks forever.

export interface InferredField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  /** Fractions of the page, top-left origin — the same shape pdfExtract stores
   *  for AcroForm widgets, so the overlay treats both identically. */
  rect: { x: number; y: number; w: number; h: number };
  page: number;
  options?: Array<{ label: string }>;
}

interface Item {
  str: string;
  x: number;
  /** Top-left origin, so comparisons read the way the page looks. */
  y: number;
  w: number;
  h: number;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";

/**
 * What kind of answer does this label want?
 *
 * Ordered most specific first: "date of birth" must be a date before "birth"
 * has a chance to look like anything else, and "signature" must win over the
 * "name" hiding inside "printed name".
 */
function inferType(label: string): string {
  const l = label.toLowerCase();
  if (/\bsignature\b|\bsigned\b|\binitials?\b/.test(l)) return "signature";
  if (/\bdate\b|\bdob\b|\bd\.?o\.?b\b|\bexpir/.test(l)) return "date";
  if (/\btime\b/.test(l)) return "time";
  if (/\bphone\b|\btel\b|\bmobile\b|\bcell\b|\bfax\b/.test(l)) return "text";
  if (/\bemail\b|e-mail/.test(l)) return "text";
  if (/\bnotes?\b|\bcomments?\b|\bdescribe\b|\bexplain\b|\bdetails?\b|\breason\b/.test(l)) return "textarea";
  if (/\baddress\b/.test(l)) return "textarea";
  return "text";
}

/** Labels that are headings or instructions, not questions. */
function isNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 40) return true;
  // A sentence is prose, not a field label.
  if (/[.!?]$/.test(t)) return true;
  if (/^(page|form|rev|revised|note|notes?|instructions?)\b/i.test(t)) return true;
  // Mostly digits is a page number or a code.
  if ((t.replace(/[^0-9]/g, "").length / t.length) > 0.5) return true;
  // Prose colons. Policy packets and manuals are full of "including but not
  // limited to:" and "Job Summary:" — paragraph lead-ins, not questions. A
  // real form label is a short noun phrase, so anything running past six
  // words or carrying a connective is rejected.
  if (t.split(/\s+/).length > 6) return true;
  if (/\b(the|and|or|but|if|when|to|for|of|that|which|are|is|be|will|may|must|should|include|including|following|such as)\b/i.test(t)) return true;
  return false;
}

/**
 * Is this line part of a paragraph rather than a form row?
 *
 * The single most reliable signal separating a form from a document: a form
 * row is short and mostly deliberate whitespace, while prose fills its line.
 * Measured in characters rather than pixels so it holds across font sizes.
 */
function isProseLine(row: Item[]): boolean {
  const text = row.map((r) => r.str).join(" ").trim();
  if (text.length > 90) return true;
  // Continuous prose has few, long runs; a form row has short ones separated
  // by gaps someone is meant to write in.
  return row.some((r) => r.str.trim().length > 45);
}

const CHECK_GLYPH = /^[☐☑☒□■○●•◦oO\[\]]+$/;

/**
 * Read one page's text runs into fields.
 *
 * @param items positioned text runs, top-left origin
 * @param pageW page width in points
 * @param pageH page height in points
 * @param pageIndex 0-based
 */
export function inferFieldsFromPage(
  items: Item[],
  pageW: number,
  pageH: number,
  pageIndex: number,
  used: Set<string>,
): { fields: InferredField[]; leftoverText: string } {
  const fields: InferredField[] = [];

  // Group into visual lines. 3pt of tolerance absorbs the sub-pixel drift you
  // get from different fonts sitting on the same baseline.
  const lines = new Map<number, Item[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const key = Math.round(it.y / 3);
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key)!.push(it);
  }

  const orderedLines = Array.from(lines.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row.sort((a, b) => a.x - b.x));

  const consumed = new Set<Item>();

  for (const row of orderedLines) {
    // Skip paragraphs wholesale rather than filtering their fragments one by
    // one — a policy manual should yield no fields at all, not a handful of
    // plausible-looking ones somebody has to notice and delete.
    if (isProseLine(row)) continue;

    for (let i = 0; i < row.length; i++) {
      const item = row[i];
      const text = item.str.trim();

      // ── A checkbox: a box glyph with its wording to the right ────────────
      if (CHECK_GLYPH.test(text) && row[i + 1]) {
        const labelItem = row[i + 1];
        const label = labelItem.str.trim();
        if (!isNoise(label)) {
          const id = uniqueId(slug(label), used);
          fields.push({
            id, label, type: "checkbox", required: false, page: pageIndex,
            rect: { x: item.x / pageW, y: (item.y - item.h) / pageH, w: item.h / pageW, h: item.h / pageH },
            options: [{ label }],
          });
          consumed.add(item);
          consumed.add(labelItem);
        }
        continue;
      }

      // ── A label: ends in a colon, with space to its right to write in ────
      if (!/:$/.test(text)) continue;
      const label = text.replace(/:+$/, "").trim();
      if (isNoise(label)) continue;

      // The answer occupies the gap between this label and whatever is next on
      // the line — or the right margin if nothing follows.
      const next = row[i + 1];
      const startX = item.x + item.w + 4;
      const endX = next ? next.x - 6 : pageW - 40;
      const width = endX - startX;
      // Too narrow to write in means the next run is a value already printed
      // on the page, not an empty box.
      if (width < 40) continue;

      const id = uniqueId(slug(label), used);
      const type = inferType(label);
      fields.push({
        id, label, type, required: false, page: pageIndex,
        rect: {
          x: startX / pageW,
          y: (item.y - item.h) / pageH,
          w: width / pageW,
          // A signature needs room for handwriting; a line of text does not.
          h: (type === "signature" ? item.h * 2.4 : item.h * 1.3) / pageH,
        },
      });
      consumed.add(item);
    }
  }

  // Whatever was not turned into a field stays available as reference text, so
  // nothing on the page is lost just because it was not a question.
  const leftoverText = items
    .filter((it) => !consumed.has(it) && it.str.trim())
    .map((it) => it.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return { fields, leftoverText };
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) { id = base + "_" + n; n += 1; }
  used.add(id);
  return id;
}

/** Build the schema sections for a flat document, one per page. */
export function buildLayoutSections(
  pages: Array<{ items: Item[]; width: number; height: number }>,
): { sections: any[]; fieldCount: number } {
  const used = new Set<string>();
  const sections: any[] = [];
  let fieldCount = 0;

  pages.forEach((page, i) => {
    const { fields, leftoverText } = inferFieldsFromPage(page.items, page.width, page.height, i, used);
    fieldCount += fields.length;

    const sectionFields: any[] = [...fields];

    // The rest of the page is kept as reference so a signer can still read the
    // policy wording they are agreeing to.
    if (leftoverText.length > 40) {
      sectionFields.push({
        id: "ref_p" + (i + 1),
        type: "policyText",
        label: pages.length > 1 ? "Page " + (i + 1) + " text" : "Form text",
        body: leftoverText,
      });
    }

    if (sectionFields.length === 0) return;
    sections.push({
      id: "sec_p" + (i + 1),
      title: pages.length > 1 ? "Page " + (i + 1) : "Form fields",
      fields: sectionFields,
    });
  });

  return { sections, fieldCount };
}

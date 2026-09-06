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
// and a printed form is a highly regular thing: a prompt, and then deliberate
// empty space for someone to write in. That space IS the field.
//
// TWO CONVENTIONS, BOTH REAL
// Measuring the agency's actual folder turned up two different house styles,
// and reading only one of them was the single biggest gap:
//
//   Colon style — "Client Last Name: ____". The label ends in a colon and the
//   answer goes to its right. Used by the older clinical forms (Care Plan,
//   Supervisory Visit, Fall Risk).
//
//   Caps-over-rule style — a small ALL-CAPS prompt with a ruled line beneath
//   it, no colon anywhere. Used by every form the agency has designed for
//   itself recently (Time Off Request, Credit Card Authorization, Vehicle
//   Authorization). Reading only colons scored those at zero fields each,
//   which is to say it failed hardest on the forms most likely to be uploaded.
//
// WHAT THIS DELIBERATELY DOES NOT DO
// It does not guess at prose. A wrong field is worse than a missing one:
// someone has to notice it and delete it, and if they do not, it becomes a
// question the form asks forever. Pages are classified before anything is read
// off them, so a policy manual yields nothing while a form page inside the
// same packet still yields its fields.

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
  /** Distance from the top of the page to the text baseline. */
  y: number;
  w: number;
  h: number;
}

interface Line {
  items: Item[];
  y: number;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";

const SMALL_WORDS = new Set(["of", "to", "in", "for", "and", "or", "the", "a", "an", "if", "by"]);

/** Title Case a shouted label so "EMPLOYEE NAME" reads as "Employee Name". */
function humanizeCaps(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    // Parenthesised letters are codes rather than words — "(h)" is the home
    // phone, "(c/w)" cell or work — so they stay shouted. The exception is a
    // trailing "(s)", which is only ever an English plural: CLIENT(S) is one
    // prompt about clients, not a prompt about the letter S.
    .replace(/\(([a-z])(\/([a-z]))?\)/g, (m, a, _slash, b) =>
      m === "(s)" ? "(s)" : "(" + a.toUpperCase() + (b ? "/" + b.toUpperCase() : "") + ")")
    .replace(/\b(ssn|dob|id|pcw|hca|epp|cvv|par|llc|usa|cpr|rn|lpn|cna)\b/gi, (m) => m.toUpperCase());
}

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
  if (/\bphone\b|\btel\b|\bmobile\b|\bcell\b|\bfax\b/.test(l)) return "tel";
  if (/\bemail\b|e-mail/.test(l)) return "email";
  if (/\b(amount|total|rate|fee|cost|deposit|balance|salary|wage|hours)\b/.test(l)) return "number";
  if (/\bnotes?\b|\bcomments?\b|\bdescribe\b|\bexplain\b|\bdetails?\b|\breason\b|\binstructions?\b/.test(l)) return "textarea";
  if (/\baddress\b/.test(l)) return "textarea";
  return "text";
}

/** Words that mark a run of text as an instruction or a heading, not a prompt. */
const INSTRUCTION_START =
  /^(page|form|rev|revised|note|notes|instructions?|please|do not|see |if you|complete|return|submit|attach|check one|circle|initial here|for office)/i;

/**
 * Procedure-writing voice.
 *
 * The SOP manual is written as numbered instructions — "Process in Care Time:",
 * "Steps to enter a new client referral:", "4. Add authorizations:". Every one
 * of those ends in a colon and is short enough to pass for a prompt, but they
 * introduce a paragraph rather than ask for anything. Matching the opening
 * verb is narrow enough not to touch real prompts, which are noun phrases.
 */
const PROCEDURAL_START =
  /^(\d+[.)]\s*)?(process|steps?|include|includes|including|enter|entering|add|adding|create|creating|update|updating|review|complete|marketing|after|before|example|goal|purpose|overview|summary|next|then|finally|first|second|third)\b/i;

/** The agency's own name, printed on every page it owns. */
const ORG_NAME = /^dare\s*(to|2)\s*care\b/i;

/** Labels that are headings or instructions, not questions. */
function isNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 48) return true;
  // A sentence is prose, not a field label.
  if (/[.!?]$/.test(t)) return true;
  if (INSTRUCTION_START.test(t)) return true;
  if (ORG_NAME.test(t)) return true;
  // Mostly digits is a page number, a code, or a street address.
  if ((t.replace(/[^0-9]/g, "").length / t.length) > 0.5) return true;
  if (t.split(/\s+/).length > 7) return true;
  return false;
}

/**
 * Letterspaced display type — "S E C T I O N 2 — O N B OA R D I N G".
 *
 * Designers space out banner text, which arrives from pdfjs as a run of
 * one-character words. It is shouting, so it passes every caps test, but it is
 * never a field prompt.
 */
function isLetterspaced(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return false;
  return words.filter((w) => w.length === 1).length / words.length >= 0.5;
}

const CAPSY = /^[A-Z0-9][A-Z0-9 /#().,'&:+-]*$/;

/** A shouted prompt sitting above a ruled line — the agency's house style. */
function isCapsLabel(text: string): boolean {
  const t = text.trim().replace(/:$/, "");
  if (t.length < 3 || t.length > 48) return false;
  if (!CAPSY.test(t)) return false;
  if (isLetterspaced(t)) return false;
  // Needs real letters; "$______" and "2851" are not prompts.
  const letters = t.replace(/[^A-Z]/g, "").length;
  if (letters < 3) return false;
  if (letters / t.length < 0.45) return false;
  if (INSTRUCTION_START.test(t)) return false;
  if (t.split(/\s+/).length > 7) return false;
  return true;
}

/**
 * A heading that starts a group of fields — "Requested Time Off".
 *
 * Title Case, alone on its line, no colon, and short. These give an imported
 * form the same section structure a person would have given it by hand.
 */
function isSectionHeading(line: Line): boolean {
  if (line.items.length !== 1) return false;
  const t = line.items[0].str.trim();
  if (t.length < 4 || t.length > 44) return false;
  if (/[.!?:]$/.test(t)) return false;
  if (isLetterspaced(t)) return false;
  if (t === t.toUpperCase()) return false; // that is a caps prompt, not a heading
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;
  // Every word that carries weight is capitalised.
  return words.every((w) => SMALL_WORDS.has(w.toLowerCase()) || /^[A-Z(]/.test(w));
}

/**
 * Is this line part of a paragraph rather than a form row?
 *
 * The single most reliable signal separating a form from a document: a form
 * row is short and mostly deliberate whitespace, while prose fills its line.
 * Measured in characters rather than pixels so it holds across font sizes.
 */
function isProseLine(line: Line): boolean {
  const text = line.items.map((r) => r.str).join(" ").trim();
  if (text.length > 90) return true;
  if (line.items.some((r) => r.str.trim().length > 45)) return true;
  return false;
}

const CHECK_GLYPH = /^[☐☑☒□■○●•◦]+$/;
/** Three or more underscores: a written-on blank inside a printed sentence. */
const RULE_RUN = /_{3,}/;

/** Two-option choices that are unambiguous wherever they appear on a form. */
const KNOWN_BINARY = new Set([
  "yes|no", "approved|denied", "accept|decline", "male|female", "true|false",
  "full-time|part-time", "am|pm", "in|out", "agree|disagree", "pass|fail",
]);

/**
 * "VISA / MASTERCARD / DISCOVER" or "Yes / No" — a choice printed inline,
 * meant to be circled. Returns the options, or null if this is not a choice.
 *
 * Deliberately strict, because a slash is used for two completely different
 * jobs on these forms. It separates alternatives ("APPROVED / DENIED"), but it
 * also just joins two names for one thing ("BILLING NAME / CARDHOLDER NAME",
 * "TOTAL HOURS / DAYS REQUESTED") — and reading those as radio buttons turns a
 * text box into a question with two wrong answers.
 *
 * So a bare pair is not enough. A choice has to announce itself: three or more
 * alternatives, or an explicit instruction to pick one, or a pairing that is
 * a choice everywhere it occurs.
 */
function slashOptions(text: string): string[] | null {
  const raw = text.trim();
  const trailingNote = raw.match(/\(([^)]*)\)\s*$/);
  const stripped = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!stripped.includes(" / ")) return null;
  const parts = stripped.split(/\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 6) return null;
  // Each option is a word or two — anything longer is a sentence with a slash.
  if (parts.some((p) => p.split(/\s+/).length > 3 || p.length > 24)) return null;
  if (parts.length >= 3) return parts;
  const saysPickOne = !!trailingNote && /circle|check|select|choose|one/i.test(trailingNote[1]);
  if (saysPickOne) return parts;
  return KNOWN_BINARY.has(parts.map((p) => p.toLowerCase()).join("|")) ? parts : null;
}

/**
 * Headings that shout.
 *
 * "SECTION 2 — ONBOARDING", "SIGNATURES", "CLIENT INFORMATION" are set in the
 * same all-caps style as the prompts around them, so nothing about their shape
 * separates them — but they are structure, not questions. Left alone they
 * become fields named "Signatures" that nobody can fill in.
 *
 * Matching a small vocabulary of structural words is blunt, and deliberately
 * so: it only ever demotes a would-be field into a section title, which is
 * recoverable in the builder, and it never invents anything.
 */
const CAPS_HEADING =
  /^(section\b|part\b|signatures$|.*\binformation$|.*\bsummary$|responsibilities$|qualifications$|.*\breview$|.*\bfeedback$|services$|acknowledge?ments?$|certifications?$|.*\bpolicy$|.*\bagreement$|contents?$)/i;

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) { id = base + "_" + n; n += 1; }
  used.add(id);
  return id;
}

/**
 * Group text runs into visual lines, top to bottom, each left to right.
 *
 * Drop caps are stitched back together on the way through. A heading set as a
 * large "E" followed by "MPLOYEE" reaches us as two runs, and read separately
 * the tail looks like a perfectly good prompt named "Mployee". Joining a lone
 * capital to the run it touches restores the word before anything reads it.
 */
function toLines(items: Item[]): Line[] {
  const buckets = new Map<number, Item[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const key = Math.round(it.y / 3);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(it);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => {
      const sorted = row.sort((a, b) => a.x - b.x);
      const merged: Item[] = [];
      for (const it of sorted) {
        const prev = merged[merged.length - 1];
        const touches = prev && it.x - (prev.x + prev.w) < 3;
        if (prev && touches && /^[A-Z]$/.test(prev.str.trim()) && /^[a-zA-Z]/.test(it.str)) {
          merged[merged.length - 1] = {
            str: prev.str.trim() + it.str,
            x: prev.x,
            y: it.y,
            w: prev.w + it.w,
            h: it.h,
          };
          continue;
        }
        merged.push(it);
      }
      return { items: merged, y: merged[0].y };
    });
}

/**
 * Decide whether a page is a form at all, before reading any fields off it.
 *
 * This is what stops a policy manual from producing questions. The agency's
 * packets are mixed — twenty-two pages of prose with a few real form pages
 * inside — so the judgement has to be per page, not per document, or the form
 * pages get thrown out along with the manual.
 *
 * The prose ratio alone is not enough, and getting that wrong is expensive in
 * both directions. An acknowledgement page — several paragraphs of policy and
 * then Name, Date, Signature — is overwhelmingly prose by line count, but it
 * is unambiguously a form: somebody signs it. So a page that asks for a
 * signature or a date is accepted on that basis, and the ratio only decides
 * the pages where nothing is being signed.
 */
function isFormPage(
  lines: Line[],
  proseCount: number,
  candidates: number,
  signing: boolean,
): boolean {
  const total = lines.length;
  if (total === 0 || candidates === 0) return false;
  if (signing) return true;
  const proseRatio = proseCount / total;
  // A page dense with prompts is a form even if it also carries instructions.
  if (candidates >= 4) return proseRatio < 0.7;
  // Otherwise it has to be mostly not-prose to qualify.
  return proseRatio < 0.35;
}

/**
 * Read one page's text runs into fields.
 *
 * @param items positioned text runs, y measured from the top of the page
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
): { fields: InferredField[]; headings: Array<{ y: number; title: string }>; leftoverText: string } {
  const fields: InferredField[] = [];
  const headings: Array<{ y: number; title: string }> = [];
  const lines = toLines(items);

  // Running headers and footers are furniture, never fields.
  const topBand = pageH * 0.055;
  const bottomBand = pageH * 0.94;

  // Display type is set larger than body text, and a document title is not a
  // prompt. Comparing against the page's own median keeps this independent of
  // whatever point size the author happened to use.
  const heights = items.map((i) => i.h).filter((h) => h > 0).sort((a, b) => a - b);
  const medianH = heights.length ? heights[Math.floor(heights.length / 2)] : 10;
  const displayH = medianH * 1.45;

  const body = lines.filter((l) => l.y > topBand && l.y < bottomBand);
  const prose = new Set(body.filter(isProseLine));

  // Count prompts first, so the page can be judged before it is mined.
  let candidates = 0;
  let signing = false;
  for (const line of body) {
    if (prose.has(line)) continue;
    for (const it of line.items) {
      if (it.h > displayH) continue;
      const t = it.str.trim();
      const bare = t.replace(/:+$/, "").trim();
      const isPrompt =
        (/:$/.test(t) && !isNoise(bare) && !PROCEDURAL_START.test(bare)) ||
        (isCapsLabel(t) && !CAPS_HEADING.test(bare));
      if (isPrompt) {
        candidates++;
        const kind = inferType(bare);
        if (kind === "signature" || kind === "date") signing = true;
      } else if (CHECK_GLYPH.test(t)) {
        candidates++;
      }
    }
  }

  if (!isFormPage(body, prose.size, candidates, signing)) {
    const leftover = items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
    return { fields: [], headings: [], leftoverText: leftover };
  }

  const consumed = new Set<Item>();

  for (const line of body) {
    // A heading, whether it is set in Title Case or shouted. Either way it
    // becomes a section title, so the imported form arrives grouped the way it
    // was printed instead of as one long list.
    const lone = line.items.length === 1 ? line.items[0].str.trim() : null;
    const capsHeading = lone && isCapsLabel(lone) && CAPS_HEADING.test(lone.replace(/:+$/, ""));
    if ((isSectionHeading(line) && line.items[0].h <= displayH) || capsHeading) {
      const raw = line.items[0].str.trim().replace(/:+$/, "");
      headings.push({ y: line.y, title: capsHeading ? humanizeCaps(raw) : raw });
      consumed.add(line.items[0]);
      continue;
    }

    // Skip paragraphs wholesale rather than filtering their fragments one by
    // one — a page of policy should yield no fields at all, not a handful of
    // plausible-looking ones somebody has to notice and delete.
    if (prose.has(line)) continue;

    const row = line.items;
    for (let i = 0; i < row.length; i++) {
      const item = row[i];
      if (consumed.has(item)) continue;
      const text = item.str.trim();
      if (item.h > displayH) continue; // display type, not a prompt

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

      const hasColon = /:$/.test(text);
      const bare = text.replace(/:+$/, "").trim();
      const caps = !hasColon && isCapsLabel(text);

      if (!hasColon && !caps) continue;
      if (isNoise(bare)) continue;
      // A shouted heading that got this far is structure, not a question.
      // Only shouted runs are demoted: "Signature:" is a colon prompt asking
      // someone to sign, while a lone "SIGNATURES" is the title of the block
      // those prompts live in.
      if (caps && CAPS_HEADING.test(bare)) continue;
      // "Process in Care Time:" introduces a paragraph; it asks for nothing.
      if (hasColon && PROCEDURAL_START.test(bare)) continue;
      // A shouted run carrying its own colon mid-string is usually a printed
      // statement — "JOB TITLE: IHSS LICENSED HEALTH CARE PROFESSIONAL" — and
      // its answer is already on the page, so there is nothing to ask. The
      // exception is when what follows the colon is a list of alternatives:
      // "TYPE OF CREDIT CARD: VISA / MASTERCARD / DISCOVER" is a real question
      // whose prompt and options happen to share one text run.
      let inlineChoice: { label: string; options: string[] } | null = null;
      if (caps && /\S:\s+\S/.test(bare)) {
        const cut = bare.indexOf(":");
        const opts = slashOptions(bare.slice(cut + 1).trim());
        if (!opts) continue;
        inlineChoice = { label: humanizeCaps(bare.slice(0, cut).trim()), options: opts };
      }

      // A label that is itself a printed choice: "APPROVED / DENIED (CIRCLE ONE)".
      const selfOptions = slashOptions(bare);
      // A colon label whose answer is printed beside it: "...: Yes / No".
      const next = row[i + 1];
      const nextOptions = hasColon && next ? slashOptions(next.str.trim()) : null;

      let label: string;
      let rect: InferredField["rect"];

      if (caps) {
        // The prompt sits above its ruled line, so the answer goes BELOW it and
        // runs to the next column, or to the right margin if this is the last
        // prompt on the line.
        const following = row.find((r) => r.x > item.x + item.w + 12);
        const endX = following ? following.x - 10 : pageW - 45;
        rect = {
          x: item.x / pageW,
          y: (item.y + 2) / pageH,
          w: Math.max(60, endX - item.x) / pageW,
          h: (item.h * 1.9) / pageH,
        };
        label = humanizeCaps(bare);
      } else {
        // Colon style: the answer occupies the gap to the right of the label.
        const startX = item.x + item.w + 4;
        const endX = next ? next.x - 6 : pageW - 40;
        const width = endX - startX;
        // Too narrow to write in means the next run is a value already printed
        // on the page, not an empty box.
        if (width < 40 && !nextOptions) continue;
        rect = {
          x: startX / pageW,
          y: (item.y - item.h) / pageH,
          w: Math.max(60, width) / pageW,
          h: (item.h * 1.4) / pageH,
        };
        label = bare;
      }

      const options = inlineChoice ? inlineChoice.options : (selfOptions || nextOptions);
      if (inlineChoice) label = inlineChoice.label;
      else if (options && selfOptions) {
        // "APPROVED / DENIED (CIRCLE ONE)" asks one question, and its own text
        // is the answer list — so the question has to be named from the
        // parenthetical, or from the options themselves.
        const note = bare.match(/\(([^)]*)\)\s*$/);
        label = note && !/circle|check|one|select/i.test(note[1])
          ? note[1]
          : humanizeCaps(selfOptions.join(" or "));
      }
      if (options && nextOptions) consumed.add(next!);

      const type = options ? "radio" : inferType(label);
      if (type === "signature") rect.h = (item.h * 2.6) / pageH;

      fields.push({
        id: uniqueId(slug(label), used),
        label,
        type,
        required: false,
        page: pageIndex,
        rect,
        ...(options ? { options: options.map((o) => ({ label: o })) } : {}),
      });
      consumed.add(item);
    }

    // ── Blanks written into a printed sentence: "no more than $______ per ..."
    // Only where the surrounding line is short enough to name the blank from.
    for (const it of row) {
      if (consumed.has(it) || !RULE_RUN.test(it.str)) continue;
      const context = row.map((r) => r.str).join(" ").replace(/_{3,}/g, " ").replace(/\s+/g, " ").trim();
      if (!context || context.length > 60) continue;
      const label = context.replace(/[:.]+$/, "").trim();
      if (isNoise(label)) continue;
      fields.push({
        id: uniqueId(slug(label), used),
        label,
        type: inferType(label),
        required: false,
        page: pageIndex,
        rect: { x: it.x / pageW, y: (it.y - it.h) / pageH, w: Math.max(70, it.w) / pageW, h: (it.h * 1.4) / pageH },
      });
      consumed.add(it);
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

  return { fields, headings, leftoverText };
}

/**
 * Build the schema sections for a flat document.
 *
 * Headings found on the page become the sections, so an imported form arrives
 * grouped the way it was printed rather than as one long undifferentiated
 * list. Pages with no headings fall back to one section per page.
 */
export function buildLayoutSections(
  pages: Array<{ items: Item[]; width: number; height: number }>,
): { sections: any[]; fieldCount: number } {
  const used = new Set<string>();
  const sections: any[] = [];
  let fieldCount = 0;

  pages.forEach((page, i) => {
    const { fields, headings, leftoverText } =
      inferFieldsFromPage(page.items, page.width, page.height, i, used);
    fieldCount += fields.length;

    if (fields.length > 0) {
      // Split this page's fields at each heading: a field belongs to the last
      // heading printed above it.
      const groups: Array<{ title: string; fields: any[] }> = [
        { title: pages.length > 1 ? "Page " + (i + 1) : "Form fields", fields: [] },
      ];
      let hi = 0;
      for (const f of fields) {
        const fy = f.rect.y * page.height;
        while (hi < headings.length && headings[hi].y <= fy) {
          groups.push({ title: headings[hi].title, fields: [] });
          hi += 1;
        }
        groups[groups.length - 1].fields.push(f);
      }

      groups.filter((g) => g.fields.length > 0).forEach((g, gi) => {
        sections.push({ id: "sec_p" + (i + 1) + "_" + gi, title: g.title, fields: g.fields });
      });
    }

    // The rest of the page is kept as reference so a signer can still read the
    // policy wording they are agreeing to.
    if (leftoverText.length > 40) {
      sections.push({
        id: "sec_ref_p" + (i + 1),
        title: pages.length > 1 ? "Page " + (i + 1) + " text" : "Form text",
        fields: [{
          id: "ref_p" + (i + 1),
          type: "policyText",
          label: pages.length > 1 ? "Page " + (i + 1) + " text" : "Form text",
          body: leftoverText,
        }],
      });
    }
  });

  return { sections, fieldCount };
}

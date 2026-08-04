// Name matching for inbound documents.
//
// Everything that arrives from outside the app — an emailed DCSC authorization,
// a certification PDF, a GoFormz export — arrives with a person's name written
// in free text, and has to be filed against a roster record. Getting it wrong
// files a client's authorization in a caregiver's folder, or worse, marks the
// wrong person compliant.
//
// So this module deliberately does NOT decide. It ranks candidates, explains
// why, and reports how confident it is. Only `confident` is safe to show as a
// pre-selected default, and even that still needs a human click.
//
// The hard cases are real, from the actual rosters:
//
//   Hardman     client Debra Hardman   vs staff Dean Hardman     ← both "D Hardman"
//   Carbajal    client Flora Carbajal  vs staff Ernest Carabajal ← 1 letter apart
//   Rodriguez   client Angelina R.     vs staff Nevaeh R.
//   Richardson  client William R.      vs staff Faith R.
//   Vuong       client Long Vuong      vs staff Vidia Vuong
//   Hunter      client Deonshay        vs client Frances
//   Harris      staff Rushane          vs staff Yvonne
//   Martinez    staff Louisa           vs staff Mark
//   Tisby       staff Kevan            vs staff Rejane
//   Coria       staff Liborio Coria    vs staff Lovenus Ruiz-Coria
//
// The cross-roster pairs are the dangerous ones: they don't just pick the wrong
// person, they pick the wrong *filing cabinet*. Any tie that spans client and
// staff is forced to `ambiguous` no matter how high it scores.

// ─── Normalisation ─────────────────────────────────────────────────────────

// Words that appear in document titles and subject lines but are never names.
// Kept deliberately tight: anything that could plausibly be someone's name
// stays in. "Long" (Long Vuong), "Faith" (Faith Richardson) and "Angel" are
// exactly why this list isn't just "common English words".
const NOISE = new Set([
  // form and packet names
  "client", "clients", "care", "plan", "plans", "review", "supervisory",
  "supervision", "visit", "visits", "new", "hire", "packet", "admission",
  "caregiver", "activity", "report", "workplace", "violence", "policy",
  "acknowledgement", "acknowledgment", "emergency", "preparedness", "epp",
  "medication", "meds", "list", "form", "forms", "sheet", "fall", "risk",
  "assessment", "employment", "application", "timesheet", "authorization",
  "authorisation", "release", "consent", "intake", "discharge",
  // document / certification types
  "soa", "dcsc", "cbi", "background", "check", "checks", "certification",
  "certificate", "cert", "cpr", "aid", "tb", "ppd", "quantiferon",
  "fingerprint", "fingerprints", "license", "licence", "credential",
  "result", "results", "passed", "cleared", "clearance",
  // agency
  "dtc", "dare", "home", "health", "healthcare", "agency", "llc", "inc",
  // email and file noise
  "re", "fw", "fwd", "reply", "forward", "attached", "attachment", "please",
  "see", "copy", "copies", "scan", "scanned", "signed", "completed", "complete",
  "final", "draft", "updated", "revised", "corrected", "pdf", "doc", "docx",
  "jpg", "png", "img", "image", "document", "file", "for", "the", "and", "of",
  // months, which show up in dated titles
  "jan", "january", "feb", "february", "mar", "march", "apr", "april",
  "jun", "june", "jul", "july", "aug", "august", "sep", "sept", "september",
  "oct", "october", "nov", "november", "dec", "december",
]);

// "May" is a month but also a plausible name, so it is not in NOISE. Same
// reasoning for "March" and "April". They are rare enough in titles that
// letting them through costs less than dropping a real first name.

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Turns free text into name-ish tokens. Hyphenated surnames are emitted both
// joined and split, so "Ruiz-Coria" can be found by a title that only says
// "Coria" without that also meaning a bare "Coria" scores as a full match.
export function tokenize(raw) {
  if (!raw) return { tokens: [], compounds: [] };
  const cleaned = stripAccents(String(raw))
    .toLowerCase()
    // dates in any of the shapes seen in GoFormz titles: 072426, 03-25-26,
    // 2026/07/24. Removed before tokenising so digits never look like names.
    .replace(/\b\d[\d/.-]*\d\b/g, " ")
    .replace(/\d+/g, " ");

  const compounds = [];
  for (const m of cleaned.matchAll(/[a-z]+(?:-[a-z]+)+/g)) {
    compounds.push(m[0].replace(/-/g, ""));
  }

  const tokens = cleaned
    .split(/[^a-z]+/)
    .filter(Boolean)
    .filter((t) => !NOISE.has(t));

  return { tokens, compounds };
}

// ─── String similarity ─────────────────────────────────────────────────────

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Jaro-Winkler favours strings that agree at the start, which is the right bias
// for surnames typed from memory: Edmundson/Edmondson and Sisineros/Sisneros
// differ in the middle, Roderiguez/Rodriguez near the end.
function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aFlags = new Array(a.length).fill(false);
  const bFlags = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bFlags[j] || a[i] !== b[j]) continue;
      aFlags[i] = true;
      bFlags[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aFlags[i]) continue;
    while (!bFlags[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;
  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

// A misspelling, not a different name. Short names get a tighter budget because
// one edit on a five-letter surname can genuinely be someone else — "Ross" and
// "Ruiz" are two different caregivers.
function isVariant(a, b) {
  if (a === b) return false;
  const len = Math.min(a.length, b.length);
  if (len < 5) return false;
  const dist = levenshtein(a, b);
  const budget = len >= 8 ? 2 : 1;
  return dist <= budget && jaroWinkler(a, b) >= 0.88;
}

// ─── Roster records ────────────────────────────────────────────────────────

/**
 * @typedef {Object} RosterPerson
 * @property {string} id
 * @property {string} name
 * @property {"client"|"staff"} subjectType
 */

function parseName(name) {
  const parts = stripAccents(String(name || ""))
    .toLowerCase()
    .split(/[^a-z-]+/)
    .filter(Boolean);
  if (!parts.length) return null;
  const first = parts[0];
  const last = parts[parts.length - 1];
  return {
    first,
    last,
    middles: parts.slice(1, -1),
    // "Ruiz-Coria" → ["ruiz", "coria"]; "Coria" → ["coria"]
    lastParts: last.split("-").filter(Boolean),
    lastJoined: last.replace(/-/g, ""),
  };
}

// ─── Scoring ───────────────────────────────────────────────────────────────

const SURNAME_EXACT = 50;
const SURNAME_VARIANT = 34;
// Matching one half of a hyphenated surname has to stay clearly below an exact
// match — a bare "Coria" is Liborio Coria before it is Lovenus Ruiz-Coria — but
// it must still clear CANDIDATE_FLOOR, or the compound-surname person silently
// disappears from the picker and can never be chosen.
const SURNAME_PART = 36;
const FIRST_EXACT = 40;
const FIRST_VARIANT = 26;
const FIRST_INITIAL = 16;
const ADJACENCY_BONUS = 8;
const EXPECT_BONUS = 6;

function scorePerson(person, parsed, { tokens, compounds }, expect) {
  const reasons = [];
  let score = 0;

  // Surname evidence.
  let surname = null;
  if (tokens.includes(parsed.lastJoined) || compounds.includes(parsed.lastJoined)) {
    surname = "exact";
    score += SURNAME_EXACT;
    reasons.push(`surname "${parsed.last}" matches exactly`);
  } else {
    const variantTok = tokens.find((t) => isVariant(t, parsed.lastJoined));
    if (variantTok) {
      surname = "variant";
      score += SURNAME_VARIANT;
      reasons.push(`surname "${variantTok}" is a spelling variant of "${parsed.last}"`);
    } else if (parsed.lastParts.length > 1) {
      const partTok = tokens.find((t) => parsed.lastParts.includes(t));
      if (partTok) {
        surname = "part";
        score += SURNAME_PART;
        reasons.push(`"${partTok}" is one half of the surname "${parsed.last}"`);
      }
    }
  }

  // First-name evidence.
  let firstKind = null;
  if (tokens.includes(parsed.first)) {
    firstKind = "exact";
    score += FIRST_EXACT;
    reasons.push(`first name "${parsed.first}" matches exactly`);
  } else {
    const variantTok = tokens.find((t) => isVariant(t, parsed.first));
    if (variantTok) {
      firstKind = "variant";
      score += FIRST_VARIANT;
      reasons.push(`first name "${variantTok}" is a spelling variant of "${parsed.first}"`);
    } else if (tokens.includes(parsed.first[0]) && parsed.first.length > 1) {
      firstKind = "initial";
      score += FIRST_INITIAL;
      reasons.push(`initial "${parsed.first[0].toUpperCase()}" is consistent with "${parsed.first}"`);
    }
  }

  // A middle name in the title is corroboration, not identification —
  // "Debra Ann Robinson" vs a bare "Debra Robinson".
  if (parsed.middles.some((m) => tokens.includes(m))) {
    score += 6;
    reasons.push("middle name also present");
  }

  // Nothing to go on.
  if (!surname && firstKind !== "exact") return null;

  // A first name with no surname at all is not an identification. Two clients
  // are called Angel; three staff surnames repeat. Score it low enough that it
  // can only ever surface as a weak suggestion.
  if (!surname) {
    score = Math.min(score, 30);
    reasons.push("no surname in the text — first name alone");
  }

  // The two tokens sitting next to each other ("Hardman, Debra") is stronger
  // evidence than the same two words scattered through a long subject line.
  const fi = tokens.indexOf(parsed.first);
  const li = tokens.indexOf(parsed.lastJoined);
  if (fi >= 0 && li >= 0 && Math.abs(fi - li) === 1) {
    score += ADJACENCY_BONUS;
    reasons.push("first and last name are adjacent");
  }

  // A soft nudge from the document type — a DCSC authorisation is about a
  // client, a background check is about a member of staff. Deliberately small:
  // supervisory visits are signed by a caregiver but file under the client, so
  // the document type is a hint about the subject, never a rule.
  if (expect && person.subjectType === expect) {
    score += EXPECT_BONUS;
    reasons.push(`document type usually concerns a ${expect}`);
  }

  return { person, score, surname, firstKind, reasons };
}

// ─── Public API ────────────────────────────────────────────────────────────

const CANDIDATE_FLOOR = 34;
const TIE_MARGIN = 15;
const CROSS_ROSTER_MARGIN = 25;
const CONFIDENT_FLOOR = 88;

/**
 * Rank roster people against a free-text name.
 *
 * @param {string} raw           subject line, form title or filename
 * @param {RosterPerson[]} roster
 * @param {{expect?: "client"|"staff", limit?: number}} [opts]
 * @returns {{confidence: "confident"|"weak"|"ambiguous"|"unmatched",
 *            candidates: Array<{id: string, name: string, subjectType: string,
 *                               score: number, reasons: string[]}>,
 *            tokens: string[],
 *            note: string}}
 */
export function matchName(raw, roster, opts = {}) {
  const { expect = null, limit = 5 } = opts;
  const bag = tokenize(raw);

  if (!bag.tokens.length) {
    return {
      confidence: "unmatched",
      candidates: [],
      tokens: [],
      note: "No name-like text found.",
    };
  }

  const scored = [];
  for (const person of roster) {
    const parsed = parseName(person.name);
    if (!parsed) continue;
    const hit = scorePerson(person, parsed, bag, expect);
    if (hit && hit.score >= CANDIDATE_FLOOR) scored.push(hit);
  }

  scored.sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));

  if (!scored.length) {
    return {
      confidence: "unmatched",
      candidates: [],
      tokens: bag.tokens,
      note: `Nothing on either roster matches "${bag.tokens.join(" ")}". This may be a former client or former member of staff, whose records still have to be retained.`,
    };
  }

  const top = scored[0];
  const runnerUp = scored[1] || null;
  const gap = runnerUp ? top.score - runnerUp.score : Infinity;

  let confidence;
  let note;

  // The cross-roster check runs first. When a tie is *also* a tie across the
  // two rosters, that is the more important thing to tell the reviewer: the
  // choice isn't just which person, it's which filing cabinet. It also uses a
  // wider margin, because the cost of getting it wrong is higher.
  if (
    runnerUp &&
    runnerUp.person.subjectType !== top.person.subjectType &&
    gap < CROSS_ROSTER_MARGIN
  ) {
    confidence = "ambiguous";
    note = `This could be ${top.person.name} (${top.person.subjectType}) or ${runnerUp.person.name} (${runnerUp.person.subjectType}) — a client file and a staff file. Pick one.`;
  } else if (runnerUp && gap < TIE_MARGIN) {
    confidence = "ambiguous";
    note = `"${top.person.name}" and "${runnerUp.person.name}" both fit. Pick one.`;
  } else if (top.firstKind !== "exact" || top.surname !== "exact") {
    // Surname plus an initial, or a spelling variant. The July inventory found
    // 53 of 126 GoFormz records were exactly this, and they are not safe to
    // pre-select.
    confidence = "weak";
    note =
      top.firstKind === "initial"
        ? `Only an initial and a surname. "${top.person.name}" is the best fit but has not been identified.`
        : `Partial match on "${top.person.name}" — confirm before filing.`;
  } else if (top.score >= CONFIDENT_FLOOR) {
    confidence = "confident";
    note = `Full name matches ${top.person.name}.`;
  } else {
    confidence = "weak";
    note = `Best fit is ${top.person.name}, but the evidence is thin.`;
  }

  return {
    confidence,
    tokens: bag.tokens,
    note,
    candidates: scored.slice(0, limit).map((s) => ({
      id: s.person.id,
      name: s.person.name,
      subjectType: s.person.subjectType,
      score: s.score,
      reasons: s.reasons,
    })),
  };
}

/**
 * True only when a match may be pre-selected in the review queue. Nothing in
 * this system files without a human click; this decides whether that click
 * lands on a default or on an empty picker.
 */
export function isPreselectable(result) {
  return result.confidence === "confident";
}

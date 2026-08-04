// What kind of document is this, and whose file does it belong in?
//
// Classification is deliberately shallow. It exists to (a) label the queue so a
// reviewer can work through one kind of document at a time, and (b) give the
// matcher a soft hint about which roster to lean towards. It never decides
// anything on its own — an unrecognised document is `unknown` and still gets
// queued, because a document nobody can classify is exactly the one a human
// needs to look at.

/**
 * @typedef {"soa"|"dcsc"|"referral"|"backgroundCheck"|"certification"
 *           |"carePlan"|"supervisoryVisit"|"unknown"} DocType
 */

// Ordered: the first rule that matches wins, so put the specific ones first.
// `expect` is the roster the matcher should lean towards, and is only set where
// the document type genuinely implies a subject.
const RULES = [
  {
    type: "dcsc",
    expect: "client",
    label: "DCSC authorization",
    // The authorisation itself: hours by type, auth number, ICD-10/service code.
    test: /\bdcsc\b|\bprior\s*auth|\bauthoriz(?:ation|ed)\s+(?:for|of|hours)|\bservice\s+auth/i,
  },
  {
    type: "soa",
    expect: "client",
    label: "Start of care",
    test: /\bsoa\b|\bstart[\s_-]*of[\s_-]*care\b/i,
  },
  {
    type: "referral",
    expect: "client",
    label: "Referral",
    test: /\breferral\b|\bnew\s+client\b|\bnew\s+referral\b|\bcase\s*manager\b/i,
  },
  {
    type: "backgroundCheck",
    expect: "staff",
    label: "Background check",
    // CBI is the Colorado Bureau of Investigation check.
    test: /\bcbi\b|\bbackground\s*check|\bcriminal\s*history|\bfingerprint|\bcaptur\w*\s*id\b/i,
  },
  {
    type: "certification",
    expect: "staff",
    label: "Certification",
    test: /\bcert(?:ificat(?:e|ion))?\b|\bcpr\b|\bfirst\s*aid\b|\bbls\b|\btb\b|\bppd\b|\bquantiferon\b|\bcna\b|\bqmap\b|\blicen[sc]e\b/i,
  },
  {
    type: "supervisoryVisit",
    // Signed by a caregiver, but files under the CLIENT — the owner decided
    // this deliberately on the interview call, because the compliance test is
    // "has this been done every three months for that particular person".
    expect: "client",
    label: "Supervisory visit",
    test: /\bsupervis\w*\s*visit|\b90[\s_-]*day\b/i,
  },
  {
    type: "carePlan",
    expect: "client",
    label: "Care plan",
    test: /\bcare\s*plan\b|\bplan\s+of\s+care\b/i,
  },
];

/**
 * @param {{subject?: string, fileName?: string, from?: string, body?: string}} input
 * @returns {{docType: DocType, expect: "client"|"staff"|null, label: string, matchedOn: string|null}}
 */
export function classify(input = {}) {
  // The filename is the most reliable signal — "CBI_result.pdf" says more than
  // a subject line of "Re: Fw: documents". Body text is checked last and only
  // its opening, because long signature blocks and disclaimers produce false
  // positives ("certified mail", "background" in a footer).
  const haystacks = [
    ["fileName", input.fileName || ""],
    ["subject", input.subject || ""],
    ["body", (input.body || "").slice(0, 500)],
  ];

  for (const rule of RULES) {
    for (const [where, text] of haystacks) {
      if (text && rule.test.test(text)) {
        return {
          docType: rule.type,
          expect: rule.expect,
          label: rule.label,
          matchedOn: where,
        };
      }
    }
  }

  return { docType: "unknown", expect: null, label: "Unclassified", matchedOn: null };
}

/** Human-readable label for a stored docType, for the review queue UI. */
export function labelFor(docType) {
  return RULES.find((r) => r.type === docType)?.label || "Unclassified";
}

export const DOC_TYPES = RULES.map(({ type, label, expect }) => ({ type, label, expect }));

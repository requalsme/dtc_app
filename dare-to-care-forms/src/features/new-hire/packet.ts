// The New Hire Packet, as data.
//
// Split out of NewHirePortal because two screens have to agree about it and
// they were drifting. The hire's own portal and the office manager's review
// each counted the packet their own way, and both counted it wrong in the same
// place: the packet contains two job descriptions but only asks for one, so a
// hire who had finished everything was shown "11 of 12" and told they had a
// form left. Anything that has to be true on both screens lives here now.

/** Every form in the packet, in the order it is signed. */
export const NEW_HIRE_FORM_KEYS = [
  "homemakerJobDescription",
  "pcwJobDescription",
  "orientationChecklist",
  "caregiverAvailability",
  "rulesOfTheRoad",
  "employeeHandbookAck",
  "policiesReceipt",
  "careScopeAndTasks",
  "workplaceViolence",
  "missedVisitsPolicy",
  "fluVaccineStatement",
  "emergencyPreparedness",
];

// Only the job description matching the hire's assigned role has to be signed —
// the packet says so explicitly — so one of these two counts, not both.
export const EITHER_OR_FORMS = [["homemakerJobDescription", "pcwJobDescription"]];

export type Requirement = {
  id: string;
  keys: string[];
  either: boolean;
  done: boolean;
};

/**
 * The packet as things that must be satisfied, rather than as a list of files.
 *
 * Order follows the packet: an either/or pair appears where its first member
 * sits, so the sequence a hire reads matches the printed packet.
 */
export function buildRequirements(filedKeys: Set<string>): Requirement[] {
  const pairFor = new Map<string, string[]>();
  for (const pair of EITHER_OR_FORMS) for (const k of pair) pairFor.set(k, pair);

  const seen = new Set<string>();
  const reqs: Requirement[] = [];
  for (const key of NEW_HIRE_FORM_KEYS) {
    if (seen.has(key)) continue;
    const pair = pairFor.get(key);
    if (pair) {
      pair.forEach((k) => seen.add(k));
      reqs.push({ id: pair.join("|"), keys: pair, either: true, done: pair.some((k) => filedKeys.has(k)) });
    } else {
      seen.add(key);
      reqs.push({ id: key, keys: [key], either: false, done: filedKeys.has(key) });
    }
  }
  return reqs;
}

/** How much of the packet is in, counted in requirements rather than files. */
export function packetProgress(filedKeys: Set<string>): { done: number; total: number } {
  const reqs = buildRequirements(filedKeys);
  return { done: reqs.filter((r) => r.done).length, total: reqs.length };
}

// Paperwork is complete when every required form is filed, treating each
// either/or pair as satisfied by one of its members.
export function paperworkComplete(filedKeys: Set<string>) {
  return buildRequirements(filedKeys).every((r) => r.done);
}

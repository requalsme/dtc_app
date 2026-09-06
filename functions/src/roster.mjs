// The roster the matcher scores against: every active client and every member
// of staff, flattened into one list tagged with which filing cabinet each
// person belongs to.
//
// Both rosters are needed in one list even though a given document only belongs
// in one of them, because the dangerous errors are the cross-roster ones —
// Debra Hardman (client) and Dean Hardman (caregiver), Flora Carbajal (client)
// and Ernest Carabajal (caregiver). A matcher that only ever saw one roster
// would resolve those confidently and wrongly.

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} sb
 * @returns {Promise<Array<{id: string, name: string, subjectType: "client"|"staff"}>>}
 */
export async function loadRoster(sb) {
  const [clients, users] = await Promise.all([
    sb.from("clients").select("id, name"),
    // `inactive` was never promoted to a column — it lives in the document — so
    // the jsonb comes along to read it below.
    sb.from("users").select("id, name, data"),
  ]);

  const roster = [];

  for (const row of clients.data || []) {
    if (row.name) roster.push({ id: row.id, name: row.name, subjectType: "client" });
  }

  for (const row of users.data || []) {
    if (!row.name) continue;
    // Former staff are kept on the roster on purpose. Their completed paperwork
    // still has to be retained, and the July inventory found 32 of 126 GoFormz
    // records belonged to people no longer active. Excluding them would send
    // those documents to "unmatched" and lose the trail.
    roster.push({
      id: row.id,
      name: row.name,
      subjectType: "staff",
      inactive: !!row.data?.inactive,
    });
  }

  return roster;
}

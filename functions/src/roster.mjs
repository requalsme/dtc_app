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
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Array<{id: string, name: string, subjectType: "client"|"staff"}>>}
 */
export async function loadRoster(db) {
  const [clientSnap, userSnap] = await Promise.all([
    db.collection("clients").get(),
    db.collection("users").get(),
  ]);

  const roster = [];

  for (const doc of clientSnap.docs) {
    const name = doc.data().name;
    if (name) roster.push({ id: doc.id, name, subjectType: "client" });
  }

  for (const doc of userSnap.docs) {
    const d = doc.data();
    if (!d.name) continue;
    // Former staff are kept on the roster on purpose. Their completed paperwork
    // still has to be retained, and the July inventory found 32 of 126 GoFormz
    // records belonged to people no longer active. Excluding them would send
    // those documents to "unmatched" and lose the trail.
    roster.push({ id: doc.id, name: d.name, subjectType: "staff", inactive: !!d.inactive });
  }

  return roster;
}

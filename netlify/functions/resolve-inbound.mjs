// POST /.netlify/functions/resolve-inbound
//
// A reviewer has decided who a queued document belongs to. This is the only
// path by which anything reaches a person's file.
//
// It runs server-side rather than in the browser because filing has to do three
// things as one step: copy the source into the person's folder, create the
// submission record, and write the audit entry. A browser that could do part of
// that could leave the record saying "filed" while the filing cabinet disagrees
// — which is why firestore.rules closes writes to `inbound` entirely.

import { firebase } from "../../functions/src/firebase.mjs";
import { requireReviewer, json, errorResponse } from "../../functions/src/auth.mjs";
import { fileInboundDocument } from "../../functions/src/resolve.mjs";

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const ctx = firebase();
  try {
    // Identity and role are re-checked here every time. The UI only offers
    // these actions to office managers; this is what enforces it.
    const actor = await requireReviewer(ctx, request);
    const body = await request.json().catch(() => ({}));
    const result = await fileInboundDocument(ctx, body, actor);
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

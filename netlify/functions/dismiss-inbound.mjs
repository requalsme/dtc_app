// POST /.netlify/functions/dismiss-inbound
//
// "This isn't a compliance record." Marks the entry dismissed with a reason and
// leaves everything else alone — the source document stays in storage and the
// entry stays in the queue. Nothing in this pipeline deletes.

import { supabaseAdmin } from "../../functions/src/supabase.mjs";
import { requireReviewer, json, errorResponse } from "../../functions/src/auth.mjs";
import { dismissInboundDocument } from "../../functions/src/resolve.mjs";

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const ctx = supabaseAdmin();
  try {
    const actor = await requireReviewer(ctx, request);
    const body = await request.json().catch(() => ({}));
    const result = await dismissInboundDocument(ctx, body, actor);
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

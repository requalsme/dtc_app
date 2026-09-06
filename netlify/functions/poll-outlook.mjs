// Scheduled: pull new documents out of the DTC Outlook into the review queue.
//
// Runs on Netlify's free tier. Every 15 minutes, ~2,900 invocations a month —
// comfortably inside the free allowance, and the mailbox is the same one
// however this is hosted.
//
// Free-tier functions get a short execution window, so this does NOT try to
// drain the mailbox in one go. It works to a wall-clock budget and leaves the
// rest for the next run; the watermark in `metadata/ingestion` makes that safe.

import { supabaseAdmin } from "../../functions/src/supabase.mjs";
import { pollMailbox } from "../../functions/src/poll.mjs";

export default async function handler() {
  const { sb } = supabaseAdmin();

  try {
    const result = await pollMailbox(
      { sb },
      {
        tenantId: process.env.GRAPH_TENANT_ID,
        clientId: process.env.GRAPH_CLIENT_ID,
        clientSecret: process.env.GRAPH_CLIENT_SECRET,
        mailbox: process.env.DTC_MAILBOX,
      },
      // Leave headroom under the runtime limit for the final write that saves
      // the watermark — losing that is what would cause repeated work.
      { budgetMs: 8000, maxMessages: 25 },
    );

    console.log(
      `Poll complete: ${result.queued} queued from ${result.processed} message(s) ` +
        `in ${result.durationMs}ms${result.stoppedEarly ? ` (stopped early: ${result.stoppedEarly})` : ""}`,
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    // A failing poll must be visible. Silence here looks exactly like an empty
    // inbox, and the difference only shows up during a survey.
    console.error("Outlook poll failed", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const config = {
  // Every 15 minutes. Referrals are not urgent to the minute, but an
  // authorization sitting unseen for hours is how a start-of-care slips.
  schedule: "*/15 * * * *",
};

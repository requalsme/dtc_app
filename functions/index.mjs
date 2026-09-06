// The ingestion library.
//
// Deliberately runtime-agnostic — nothing in here imports a hosting provider's
// SDK. It needs a Supabase client and a Graph credential, and it will run
// anywhere that can supply those: a Netlify scheduled function (what we deploy
// today), a GitHub Actions cron, or a laptop doing a one-off backfill.
//
// That portability is the point, and it is why this survived the move off
// Firebase almost untouched — only the storage layer underneath it changed.
//
// The deployed entry points live in `netlify/functions/`.

export { matchName, tokenize, isPreselectable } from "./src/matcher.mjs";
export { classify, labelFor, DOC_TYPES } from "./src/classify.mjs";
export { loadRoster } from "./src/roster.mjs";
export { enqueue, INBOUND } from "./src/queue.mjs";
export { pollMailbox } from "./src/poll.mjs";
export { fileInboundDocument, dismissInboundDocument } from "./src/resolve.mjs";
export { supabaseAdmin, BUCKETS } from "./src/supabase.mjs";
export { requireReviewer, json, errorResponse, HttpError } from "./src/auth.mjs";
export { getToken, listMessagesSince, listAttachments, GraphError } from "./src/graph.mjs";

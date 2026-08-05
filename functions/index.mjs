// The ingestion library.
//
// Deliberately runtime-agnostic — nothing in here imports a hosting provider's
// SDK. It needs a Firestore handle, a Storage bucket and a Graph credential,
// and it will run anywhere that can supply those: a Netlify scheduled function
// (what we deploy today), a GitHub Actions cron, or a laptop doing a one-off
// backfill.
//
// That portability is the point. An earlier version of this was written as
// Firebase Cloud Functions, which meant the project had to be on a paid plan
// before a cron could run once every half hour. The logic never needed that.
//
// The deployed entry points live in `netlify/functions/`.

export { matchName, tokenize, isPreselectable } from "./src/matcher.mjs";
export { classify, labelFor, DOC_TYPES } from "./src/classify.mjs";
export { loadRoster } from "./src/roster.mjs";
export { enqueue, INBOUND, INBOUND_PREFIX } from "./src/queue.mjs";
export { pollMailbox } from "./src/poll.mjs";
export { fileInboundDocument, dismissInboundDocument } from "./src/resolve.mjs";
export { firebase } from "./src/firebase.mjs";
export { requireReviewer, json, errorResponse, HttpError } from "./src/auth.mjs";
export { getToken, listMessagesSince, listAttachments, GraphError } from "./src/graph.mjs";

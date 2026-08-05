// Who is calling, and are they allowed to file a document?
//
// A Cloud Functions callable got the caller's identity for free. Over plain
// HTTP we have to do it ourselves: verify the Firebase ID token the browser
// sent, then look up that user's role in Firestore.
//
// The role check is deliberately server-side and repeated here even though the
// UI only shows these actions to office managers. The UI decides what is
// convenient to offer; this decides what is allowed.

import { getAuth } from "firebase-admin/auth";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/**
 * @param {{app: import("firebase-admin/app").App, db: FirebaseFirestore.Firestore}} ctx
 * @param {Request|{headers: any}} request
 * @returns {Promise<{uid: string, name: string, role: string}>}
 */
export async function requireReviewer(ctx, request) {
  const header =
    typeof request.headers?.get === "function"
      ? request.headers.get("authorization")
      : request.headers?.authorization;

  const token = /^Bearer (.+)$/i.exec(header || "")?.[1];
  if (!token) throw new HttpError(401, "Sign in first.");

  let decoded;
  try {
    decoded = await getAuth(ctx.app).verifyIdToken(token);
  } catch {
    // Covers expired, malformed and forged tokens alike. The caller doesn't
    // need to know which — they need to sign in again either way.
    throw new HttpError(401, "Your session has expired. Sign in again.");
  }

  const user = (await ctx.db.collection("users").doc(decoded.uid).get()).data();
  if (user?.role !== "admin" && user?.role !== "officeManager") {
    throw new HttpError(
      403,
      "Only an office manager or administrator can file an inbound document.",
    );
  }

  return { uid: decoded.uid, name: user.name || "Office", role: user.role };
}

/** Consistent JSON responses, so the client can always read `error`. */
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(err) {
  const status = err instanceof HttpError ? err.status : 500;
  // Unexpected failures must not leak stack traces or key material to a browser.
  const message =
    err instanceof HttpError ? err.message : "Something went wrong filing that document.";
  if (status === 500) console.error(err);
  return json({ error: message }, status);
}

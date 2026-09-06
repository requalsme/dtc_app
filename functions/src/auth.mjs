// Who is calling, and are they allowed to file a document?
//
// A Cloud Functions callable got the caller's identity for free. Over plain
// HTTP we have to do it ourselves: verify the access token the browser sent,
// then look up that user's role.
//
// The role check is deliberately server-side and repeated here even though the
// UI only shows these actions to office managers. The UI decides what is
// convenient to offer; this decides what is allowed.
//
// It matters more here than it did under Firestore rules, not less: these
// endpoints run under the service-role key, which bypasses Row Level Security
// entirely. The database will not second-guess them, so this function is the
// whole boundary.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/**
 * @param {{sb: import("@supabase/supabase-js").SupabaseClient}} ctx
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

  // getUser(token) validates the signature and expiry against the project's
  // own keys rather than trusting anything the caller encoded in the JWT.
  const { data, error } = await ctx.sb.auth.getUser(token);
  if (error || !data?.user) {
    // Covers expired, malformed and forged tokens alike. The caller doesn't
    // need to know which — they need to sign in again either way.
    throw new HttpError(401, "Your session has expired. Sign in again.");
  }

  const uid = data.user.id;
  const { data: profile } = await ctx.sb
    .from("users")
    .select("name, role")
    .eq("id", uid)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "officeManager") {
    throw new HttpError(
      403,
      "Only an office manager or administrator can file an inbound document.",
    );
  }

  return { uid, name: profile.name || "Office", role: profile.role };
}

/**
 * Admin-only variant, for actions that create accounts rather than file
 * documents. An office manager reviews paperwork; handing out logins is a
 * separate, higher bar.
 */
export async function requireAdmin(ctx, request) {
  const actor = await requireReviewer(ctx, request);
  if (actor.role !== "admin") {
    throw new HttpError(403, "Only an administrator can do that.");
  }
  return actor;
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

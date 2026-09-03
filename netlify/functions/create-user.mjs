// POST /.netlify/functions/create-user
//
// Creating a staff account. New in the Supabase migration, and worth explaining
// because it replaces something that used to happen in the browser.
//
// Firebase's createUserWithEmailAndPassword signs the NEW user in, replacing
// whoever was already signed in — so the admin creating an account would be
// kicked out of their own session. The app worked around that with a second
// Firebase app instance ("Secondary") whose only job was to hold a throwaway
// session. Supabase's browser signUp has the same behaviour and the same
// workaround would have been possible.
//
// It is done here instead because that was always the right place for it.
// Handing out a login is an administrative act: it needs the service-role key,
// and it needs the caller's role checked by something the caller cannot edit.
// Doing it in the browser meant the only thing standing between a caregiver and
// a new admin account was which buttons the UI chose to render.

import { supabaseAdmin } from "../../functions/src/supabase.mjs";
import { requireAdmin, json, errorResponse, HttpError } from "../../functions/src/auth.mjs";

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const ctx = supabaseAdmin();
  try {
    // Admin, not merely staff. An office manager can review paperwork; only an
    // administrator can create an account.
    await requireAdmin(ctx, request);

    const body = await request.json().catch(() => ({}));
    const { email, password, name, role, ...rest } = body;

    if (!email || !password || !name) {
      throw new HttpError(400, "email, password and name are required.");
    }
    if (!["admin", "officeManager", "caregiver", "newHire", "client"].includes(role)) {
      throw new HttpError(400, "That is not a valid role.");
    }
    // devAccess is never accepted from a request body. It is granted by hand,
    // by an existing admin or dev, and the database trigger would reject it
    // here anyway — this just refuses it before it gets that far, so the
    // failure is a clear message rather than a database error.
    if ("devAccess" in body) {
      throw new HttpError(400, "devAccess cannot be set when creating an account.");
    }

    const { data: created, error } = await ctx.sb.auth.admin.createUser({
      email: String(email).toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (error) throw new HttpError(400, error.message);

    const initials =
      String(name)
        .split(" ")
        .map((s) => s[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

    // The on_auth_user_created trigger already made a bare row; this completes
    // it. Upsert rather than insert, so the two cannot race into a conflict.
    const profile = {
      name,
      email: String(email).toLowerCase(),
      role,
      status: "active",
      must_change_password: true, // the password above is temporary, by design
      created_at: new Date().toISOString(),
      last_login_at: null,
      data: { ...rest, initials },
    };

    const { error: profileError } = await ctx.sb
      .from("users")
      .upsert({ id: created.user.id, ...profile });
    if (profileError) throw new HttpError(500, "The account was created but its profile was not saved.");

    return json({
      id: created.user.id,
      name,
      email: profile.email,
      role,
      initials,
      status: "active",
      mustChangePassword: true,
      createdAt: profile.created_at,
      lastLoginAt: null,
      ...rest,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

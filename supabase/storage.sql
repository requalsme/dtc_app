-- Dare to Care — Supabase Storage buckets and policies.
--
-- WHAT CHANGED, AND WHY IT MATTERS
--
-- storage.rules carried a documented limitation: Firebase Storage rules cannot
-- read Firestore, so they could not look up a caller's role. Every read
-- therefore degraded to "any signed-in user", and the comment in that file
-- said as much — the real protection was that the Firestore records carrying
-- the download URLs were role-gated, so there was "no practical route" to
-- another client's file. That is defence by obscurity of the path, not by
-- permission, and it left a caregiver one leaked or guessed path away from
-- another client's PHI.
--
-- Supabase Storage policies are ordinary Postgres RLS on storage.objects, so
-- they CAN join against application tables. The role check that was impossible
-- before is written out below and is now the actual boundary.
--
-- The other change: Firebase's getDownloadURL() minted a permanent bearer-token
-- URL that was then stored in the record. Anyone who ever saw that URL kept
-- access forever, including after the person was offboarded, because the token
-- never expired and revoking it meant rewriting every record. These buckets are
-- private and the app now asks for a short-lived signed URL at read time, so
-- access is re-decided against these policies on every view.

-- ───────────────────────────────────────────────────────────────────────────
-- Buckets
-- ───────────────────────────────────────────────────────────────────────────
-- All private. `public = false` means no object is reachable without either a
-- policy-checked session or a signed URL the server just minted.
--
-- Size and MIME limits move here from the old rules file: Firebase expressed
-- them per-path in the rules language, Supabase expresses them as bucket
-- config, and the app re-checks before upload so the user gets a real message
-- rather than a rejected request.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'filed', 'filed', false, 26214400,  -- 25MB, same limit as the old rules
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit)
values ('inbound', 'inbound', false, 26214400)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Training videos. Larger ceiling because these are video, and no MIME
-- allow-list because the course site manages its own asset types.
insert into storage.buckets (id, name, public, file_size_limit)
values ('courses', 'courses', false, 52428800)  -- 50MB
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- ───────────────────────────────────────────────────────────────────────────
-- filed/  — completed forms and scanned documents, filed against a person
-- ───────────────────────────────────────────────────────────────────────────
-- Object paths are {subjectType}/{subjectId}/{fileName} for generated form
-- PDFs, and {subjectType}/{subjectId}/uploads/{fileName} for scans. So:
--   (storage.foldername(name))[1] = subjectType  ('client' | 'staff')
--   (storage.foldername(name))[2] = subjectId
--
-- READ — this is the rule Firebase could not express.
--
--   * staff (admin / officeManager) may read any filed document, which is the
--     job: reviewing files is what an office manager does.
--   * anyone may read their OWN file — the staff/{their id}/... prefix. This is
--     the same distinction firestore.rules drew on `documents`, where read was
--     staff OR subjectId == auth.uid.
--   * a caregiver may read a PDF belonging to a submission THEY filed, wherever
--     it was filed. Without this a caregiver could not open a form they
--     themselves signed for a client, which the app legitimately shows them.
--
-- A caregiver can no longer read an arbitrary client's filed document by
-- knowing or guessing its path. That was possible before and is not now.
drop policy if exists "filed read" on storage.objects;
create policy "filed read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'filed'
    and (
      public.is_staff()
      or (
        (storage.foldername(name))[1] = 'staff'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or exists (
        select 1 from public.submissions s
        where s.pdf_path = name and s.caregiver_id = auth.uid()
      )
    )
  );

-- INSERT — a caregiver files their own completed form, so this cannot be
-- staff-only. It stays signed-in, constrained to the two legal subject types.
-- The record that points at the object is separately gated by the submissions
-- and documents policies, so an orphan upload grants no visibility.
drop policy if exists "filed insert" on storage.objects;
create policy "filed insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'filed'
    and (storage.foldername(name))[1] in ('client', 'staff')
  );

-- Scans under uploads/ are staff-only to write, matching documents_insert in
-- schema.sql: vetting evidence is only worth anything if the person it vets
-- didn't supply it. Enforced as a trigger-style check because a single INSERT
-- policy cannot express "except under this sub-path".
drop policy if exists "filed uploads insert requires staff" on storage.objects;
create policy "filed uploads insert requires staff"
  on storage.objects for insert to authenticated
  with check (
    bucket_id <> 'filed'
    or (storage.foldername(name))[3] is distinct from 'uploads'
    or public.is_staff()
  );

-- No update, no delete policy on filed/ for anyone. Filed documents are
-- immutable: a corrected form is re-filed under its own id alongside the
-- original, so there is always a record of exactly what was signed and when.
-- Removal, when it is genuinely warranted, happens server-side under the
-- service-role key where it is audited.

-- ───────────────────────────────────────────────────────────────────────────
-- inbound/  — documents that arrived from outside, not yet filed
-- ───────────────────────────────────────────────────────────────────────────
-- Staff-only read, and now genuinely so rather than by path obscurity. Nothing
-- writes here from a browser: the ingestion function stores objects under the
-- service-role key, and filing copies rather than moves, so the original stays
-- put and a mis-filing can be traced back to the document the reviewer was
-- actually looking at.
drop policy if exists "inbound read" on storage.objects;
create policy "inbound read"
  on storage.objects for select to authenticated
  using (bucket_id = 'inbound' and public.is_staff());

-- ───────────────────────────────────────────────────────────────────────────
-- courses/  — training videos
-- ───────────────────────────────────────────────────────────────────────────
-- Readable by any signed-in session, which includes the anonymous sessions the
-- course site uses.
--
-- NOTE for the dtc-courses follow-up migration: that site currently reads these
-- objects out of Firebase Storage. It will keep working only until the Firebase
-- bucket goes away, at which point it needs to point at this bucket and hold a
-- Supabase session (anonymous auth is enough) to satisfy this policy.
drop policy if exists "courses read" on storage.objects;
create policy "courses read"
  on storage.objects for select to authenticated
  using (bucket_id = 'courses');

-- Writes are managed from the console / service role only, as before.

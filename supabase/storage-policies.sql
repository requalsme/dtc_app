
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

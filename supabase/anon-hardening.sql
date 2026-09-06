-- Keep anonymous sessions out of the clinical data.
--
-- WHY THIS IS NEEDED NOW
-- Anonymous sign-ins had to be enabled: the course site signs in anonymously to
-- record certificates and course progress. But Supabase gives an anonymous user
-- the `authenticated` role - the same role every policy in schema.sql grants to.
-- Enabling it therefore silently widened every one of those policies to include
-- anyone holding the (public, embedded-in-the-bundle) anon key.
--
-- Firebase had the same hole: isSignedIn() was request.auth != null, which is
-- true for an anonymous session, and the course site used exactly that. So this
-- is not a regression introduced by the migration - it is the same class of
-- defect as the Storage role check that firestore rules could not express, and
-- it is fixed here for the same reason: Postgres can tell the two apart and
-- Firebase rules could not.
--
-- WHAT THE COURSE SITE ACTUALLY NEEDS, and therefore what stays open to an
-- anonymous session: certificates, course_progress, course_handoffs, courses,
-- and the courses storage bucket. Nothing else. A caregiver's file, a client
-- record and the audit log are none of a course player's business.

-- True for a real signed-in person, false for an anonymous session.
-- The claim is set by GoTrue itself and cannot be forged by the client, since
-- the JWT is signed with the project's key.
create or replace function public.is_real_user()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

-- Every helper already answers false for an anonymous session (it has no
-- profile row), so is_staff/is_admin/is_dev need no change. What needs changing
-- is each policy whose test was merely "is there a session at all".

drop policy if exists users_read on public.users;
create policy users_read on public.users
  for select to authenticated using (public.is_real_user());

drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients
  for select to authenticated using (public.is_real_user());

drop policy if exists templates_read on public.templates;
create policy templates_read on public.templates
  for select to authenticated using (public.is_real_user());

drop policy if exists submissions_read on public.submissions;
create policy submissions_read on public.submissions
  for select to authenticated
  using (public.is_real_user() and (public.is_staff() or caregiver_id = auth.uid()));

drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions
  for insert to authenticated
  with check (public.is_real_user() and status = 'submitted');

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select to authenticated
  using (public.is_real_user() and (public.is_staff() or subject_id = auth.uid()::text));

drop policy if exists audit_read on public.audit;
create policy audit_read on public.audit
  for select to authenticated using (public.is_real_user());

drop policy if exists audit_insert on public.audit;
create policy audit_insert on public.audit
  for insert to authenticated with check (public.is_real_user());

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select to authenticated using (public.is_real_user());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_real_user()) with check (public.is_real_user());

-- app_metadata: the setup row stays readable to anon (the app must answer
-- "has anyone set this up yet?" before login), but writing it should not be
-- something an anonymous session can do.
drop policy if exists app_metadata_setup_write on public.app_metadata;
create policy app_metadata_setup_write on public.app_metadata
  for all to authenticated
  using (id = 'setup' and public.is_real_user())
  with check (id = 'setup' and public.is_real_user());

-- Storage: a filed clinical document is never a course player's business.
drop policy if exists "filed read" on storage.objects;
create policy "filed read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'filed'
    and public.is_real_user()
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

drop policy if exists "filed insert" on storage.objects;
create policy "filed insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'filed'
    and public.is_real_user()
    and (storage.foldername(name))[1] in ('client', 'staff')
  );

-- Deliberately NOT tightened, because the course site depends on them:
--   certificates       (read, and insert where source = 'course-site')
--   course_progress    (read / insert / update)
--   course_handoffs    (read - this is how the handoff is redeemed)
--   courses            (read)
--   courses storage bucket
--   app_metadata setup (read)

-- Dare to Care — Postgres schema and Row Level Security.
--
-- This is a direct translation of firestore.rules (238 lines, as deployed at
-- commit d4b7f6a) into Postgres. Every access decision that file made is
-- reproduced here; nothing was relaxed in the move. Where a rule could not be
-- expressed as RLS it became a trigger, and the reason is written above it.
--
-- SHAPE OF THESE TABLES
-- Firestore documents had no fixed schema, and several collections genuinely
-- rely on that: a template carries an arbitrary nested `sections` array, and a
-- submission carries whatever answers its form asked for. Rather than invent a
-- column layout for data that does not have one (and risk dropping fields from
-- 39 hand-verified client records), each table promotes to real columns only
-- the fields that security policies, foreign keys, or queries actually need,
-- and keeps the rest of the document verbatim in `data jsonb`.
--
-- The consequence worth knowing: a promoted column is authoritative. The data
-- layer strips promoted keys out of `data` on write, so there is exactly one
-- copy of `status`, `caregiver_id`, and friends — never a jsonb shadow that can
-- drift out of step with the column an RLS policy is reading.

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────────────────
-- users  (table only)
-- ───────────────────────────────────────────────────────────────────────────
-- Defined before the role helpers below, because those are `language sql` and
-- Postgres validates a SQL function body at CREATE time - a helper that reads
-- public.users cannot be declared before public.users exists. Its RLS policies
-- come further down, since they in turn depend on the helpers.
--
-- Keyed on auth.users(id). Firebase UIDs were 28-character strings and cannot
-- be a uuid, so every account is re-keyed on import; `legacy_uid` keeps the old
-- value so a migrated record can always be traced back to its Firebase origin.

create table if not exists public.users (
  id                   uuid primary key references auth.users(id) on delete cascade,
  legacy_uid           text unique,
  name                 text,
  email                text,
  role                 text not null default 'caregiver'
                         check (role in ('admin', 'officeManager', 'caregiver', 'newHire', 'client')),
  dev_access           boolean not null default false,
  status               text,
  must_change_password boolean not null default false,
  -- Read by the course_handoffs policy: a new hire may not mint a handoff until
  -- their training has actually been released.
  courses_unlocked_at  timestamptz,
  created_at           timestamptz not null default now(),
  last_login_at        timestamptz,
  data                 jsonb not null default '{}'::jsonb
);

-- ───────────────────────────────────────────────────────────────────────────
-- Role helpers
-- ───────────────────────────────────────────────────────────────────────────
-- These MUST be SECURITY DEFINER. A policy on `users` that resolves a role by
-- selecting from `users` re-enters that same policy and recurses until Postgres
-- gives up. Running the lookup as the definer bypasses RLS for this one read,
-- which is the standard way out and is safe because each function returns a
-- single scalar about the caller themselves — never another user's row.
--
-- `search_path` is pinned empty so a caller cannot shadow `public.users` with a
-- table of their own and answer these questions for themselves.

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.role from public.users u where u.id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.role = 'admin' from public.users u where u.id = auth.uid()),
    false
  )
$$;

-- Office managers and admins. The bar for reading other people's clinical
-- documents and for every privileged write.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.role in ('admin', 'officeManager') from public.users u where u.id = auth.uid()),
    false
  )
$$;

-- Independent of role, exactly as in firestore.rules. Someone's real job in the
-- roster can legitimately be "caregiver" while they also hold owner-level
-- access to the dev portal. Only ever granted by hand or by an existing
-- admin/dev — never self-service (see the trigger on `users`).
create or replace function public.is_dev()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.dev_access from public.users u where u.id = auth.uid()),
    false
  )
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- users  (access control)
-- ───────────────────────────────────────────────────────────────────────────

alter table public.users enable row level security;

drop policy if exists users_read on public.users;
create policy users_read on public.users
  for select to authenticated
  using (true);

-- Create/update mirror the Firestore rule: an admin or dev may write anyone's
-- profile, and anyone may write their own. The devAccess carve-out that made
-- the original rule interesting is enforced by the trigger below rather than
-- here, because WITH CHECK cannot see the pre-update row.
drop policy if exists users_insert on public.users;
create policy users_insert on public.users
  for insert to authenticated
  with check (public.is_admin() or public.is_dev() or id = auth.uid());

drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (public.is_admin() or public.is_dev() or id = auth.uid())
  with check (public.is_admin() or public.is_dev() or id = auth.uid());

-- No delete policy: absent policy means denied, matching `allow delete: if false`.

-- The privilege-escalation guard, preserved exactly.
--
-- In Firestore this was expressible inline because rules can diff
-- request.resource.data against resource.data. Postgres RLS cannot: WITH CHECK
-- sees only the row as it will be, not as it was, so "you may edit yourself but
-- not this one field" has to be a trigger. Without it, anyone editing their own
-- profile — a legitimately self-serve screen — could add one field and hand
-- themselves the dev portal.
create or replace function public.guard_dev_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.dev_access is true and not (public.is_admin() or public.is_dev()) then
      raise exception 'devAccess can only be granted by an administrator or dev user';
    end if;
    return new;
  end if;

  if new.dev_access is distinct from old.dev_access
     and not (public.is_admin() or public.is_dev()) then
    raise exception 'devAccess can only be changed by an administrator or dev user';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_dev_access on public.users;
create trigger guard_dev_access
  before insert or update on public.users
  for each row execute function public.guard_dev_access();

-- ───────────────────────────────────────────────────────────────────────────
-- clients
-- ───────────────────────────────────────────────────────────────────────────
-- Firestore document ids are preserved as text primary keys so that every
-- reference already written into other records keeps pointing at the same
-- client after the move.

create table if not exists public.clients (
  id         text primary key,
  name       text,
  status     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

alter table public.clients enable row level security;

drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients
  for select to authenticated using (true);
drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ───────────────────────────────────────────────────────────────────────────
-- templates
-- ───────────────────────────────────────────────────────────────────────────
-- Admin/dev only to write. Changing a template silently changes the meaning of
-- every future submission made against it, so an office manager may assign and
-- review forms but not alter the forms themselves.

create table if not exists public.templates (
  id         text primary key,   -- the schema key
  name       text,
  status     text,
  version    integer default 1,
  updated_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

alter table public.templates enable row level security;

drop policy if exists templates_read on public.templates;
create policy templates_read on public.templates
  for select to authenticated using (true);
drop policy if exists templates_write on public.templates;
create policy templates_write on public.templates
  for all to authenticated
  using (public.is_admin() or public.is_dev())
  with check (public.is_admin() or public.is_dev());

-- ───────────────────────────────────────────────────────────────────────────
-- submissions
-- ───────────────────────────────────────────────────────────────────────────
-- The security fix from d4b7f6a lives here: read is staff, or the caregiver who
-- filed that specific submission — NOT any signed-in user.

create table if not exists public.submissions (
  id             text primary key,
  caregiver_id   uuid references public.users(id) on delete set null,
  caregiver_name text,
  client_id      text references public.clients(id) on delete set null,
  client_name    text,
  schema_key     text,
  template_name  text,
  status         text not null default 'submitted',
  submitted_at   timestamptz,
  subject_type   text check (subject_type in ('client', 'staff')),
  subject_id     text,
  pdf_path       text,
  pdf_pending    boolean not null default false,
  pdf_filed_at   timestamptz,
  -- Soft delete. A filed submission is compliance evidence, so it is never
  -- physically erased in the ordinary course of work — it is stamped
  -- removed-from-view, restorable, and still present in full for an audit.
  deleted_at     timestamptz,
  deleted_by     text,
  deleted_by_id  uuid,
  delete_reason  text,
  data           jsonb not null default '{}'::jsonb
);

create index if not exists submissions_caregiver_idx on public.submissions (caregiver_id);
create index if not exists submissions_client_idx    on public.submissions (client_id);
create index if not exists submissions_subject_idx   on public.submissions (subject_type, subject_id);

alter table public.submissions enable row level security;

drop policy if exists submissions_read on public.submissions;
create policy submissions_read on public.submissions
  for select to authenticated
  using (public.is_staff() or caregiver_id = auth.uid());

-- Anyone signed in may file a form, but it must arrive as "submitted", so a
-- record cannot be created pre-reviewed or pre-approved.
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions
  for insert to authenticated
  with check (status = 'submitted');

-- Staff may review and correct. The caregiver who filed it may only touch it
-- while it is sitting in needsCorrection — i.e. to fix what they were asked to
-- fix. The soft-delete carve-out is in the trigger below.
drop policy if exists submissions_update on public.submissions;
create policy submissions_update on public.submissions
  for update to authenticated
  using (
    public.is_staff()
    or (caregiver_id = auth.uid() and status = 'needsCorrection')
  )
  with check (
    public.is_staff()
    or caregiver_id = auth.uid()
  );

-- Hard delete is dev-only AND only for a record already soft-deleted. Nothing
-- goes from "filed" to "gone" in one step; it must pass through
-- "removed from view" first, which is a built-in cooling-off period.
drop policy if exists submissions_delete on public.submissions;
create policy submissions_delete on public.submissions
  for delete to authenticated
  using (public.is_dev() and deleted_at is not null);

-- Soft-delete fields are dev-only, even on an otherwise permitted update. An
-- office manager can review and correct a record; removing one from view — even
-- reversibly — is an owner-level call. Same OLD-vs-NEW problem as devAccess, so
-- same solution.
create or replace function public.guard_submission_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.deleted_at    is distinct from old.deleted_at)
  or (new.deleted_by    is distinct from old.deleted_by)
  or (new.deleted_by_id is distinct from old.deleted_by_id)
  or (new.delete_reason is distinct from old.delete_reason) then
    if not public.is_dev() then
      raise exception 'Only a dev user may soft-delete or restore a submission';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_submission_soft_delete on public.submissions;
create trigger guard_submission_soft_delete
  before update on public.submissions
  for each row execute function public.guard_submission_soft_delete();

-- ───────────────────────────────────────────────────────────────────────────
-- inbound
-- ───────────────────────────────────────────────────────────────────────────
-- Documents that arrived from outside the app, waiting for a human to say who
-- they belong to. Read is staff-only: an unreviewed queue is a pile of other
-- people's clinical documents with no filing decision made yet.
--
-- Writes are closed to every client entirely. Entries are created by the
-- ingestion function and resolved by the resolve/dismiss endpoints, both of
-- which run under the service-role key and re-check the caller's role. Keeping
-- the browser out means a reviewer cannot mark a document filed without the
-- server also copying it into the person's file and writing the audit entry —
-- the record and the reality stay together.

create table if not exists public.inbound (
  id         text primary key,
  status     text,
  created_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

alter table public.inbound enable row level security;

drop policy if exists inbound_read on public.inbound;
create policy inbound_read on public.inbound
  for select to authenticated using (public.is_staff());
-- No insert/update/delete policy: server-side (service role) only.

-- ───────────────────────────────────────────────────────────────────────────
-- applications
-- ───────────────────────────────────────────────────────────────────────────
-- Employment applications from careers.daretocarehomecare.com. Contains an
-- encrypted SSN and applicant PII, so read is office-manager-and-above.
-- Created server-side only — a browser can never forge one.

create table if not exists public.applications (
  id          text primary key,
  status      text,
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text,
  created_at  timestamptz not null default now(),
  data        jsonb not null default '{}'::jsonb
);

alter table public.applications enable row level security;

drop policy if exists applications_read on public.applications;
create policy applications_read on public.applications
  for select to authenticated using (public.is_staff());

drop policy if exists applications_update on public.applications;
create policy applications_update on public.applications
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- No insert policy (server-side only) and no delete policy.

-- A reviewer may mark an application reviewed and leave a note. They may not
-- rewrite what the applicant actually submitted — which in Firestore was
-- `hasOnly([status, reviewedAt, reviewedBy, reviewNote])` and here has to
-- compare against the pre-update row.
create or replace function public.guard_application_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
     or new.data is distinct from old.data then
    raise exception 'Only status, reviewedAt, reviewedBy and reviewNote may be changed on an application';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_application_fields on public.applications;
create trigger guard_application_fields
  before update on public.applications
  for each row execute function public.guard_application_fields();

-- ───────────────────────────────────────────────────────────────────────────
-- tasks
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.tasks (
  id         text primary key,
  status     text,
  due_date   date,
  created_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

alter table public.tasks enable row level security;

drop policy if exists tasks_read   on public.tasks;
create policy tasks_read   on public.tasks for select to authenticated using (true);
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_staff());
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated using (true) with check (true);
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_staff());

-- ───────────────────────────────────────────────────────────────────────────
-- audit
-- ───────────────────────────────────────────────────────────────────────────
-- Append-only. No update policy and no delete policy, by anyone, which is the
-- whole point of a log.

create table if not exists public.audit (
  id        text primary key default gen_random_uuid()::text,
  action    text,
  target    text,
  detail    text,
  actor     text,
  role      text,
  timestamp timestamptz not null default now(),
  data      jsonb not null default '{}'::jsonb
);

create index if not exists audit_timestamp_idx on public.audit (timestamp desc);

alter table public.audit enable row level security;

drop policy if exists audit_read   on public.audit;
create policy audit_read   on public.audit for select to authenticated using (true);
drop policy if exists audit_insert on public.audit;
create policy audit_insert on public.audit for insert to authenticated with check (true);

-- ───────────────────────────────────────────────────────────────────────────
-- documents
-- ───────────────────────────────────────────────────────────────────────────
-- Scanned documents attached to a person — licences, I-9s, background check
-- results, packets signed on paper.
--
-- Create is staff-only and self-attributed: a caregiver must not be able to
-- drop a document into their own file claiming it is a clean CBI result.
-- Vetting evidence is only worth anything if the person it vets didn't supply
-- it. No update and no delete by anyone — a wrong upload is superseded by a
-- correct one, never edited away.

create table if not exists public.documents (
  id                text primary key,
  subject_type      text not null check (subject_type in ('client', 'staff')),
  subject_id        text not null,
  checklist_item_id text,
  file_name         text,
  content_type      text,
  size              bigint,
  storage_path      text,
  document_date     date,
  note              text,
  uploaded_by       text,
  uploaded_by_id    uuid references public.users(id) on delete set null,
  uploaded_at       timestamptz not null default now(),
  source            text,
  data              jsonb not null default '{}'::jsonb
);

create index if not exists documents_subject_idx on public.documents (subject_type, subject_id);

alter table public.documents enable row level security;

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select to authenticated
  using (public.is_staff() or subject_id = auth.uid()::text);

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    public.is_staff()
    and uploaded_by_id = auth.uid()
    and subject_type in ('client', 'staff')
  );

-- No update policy and no delete policy. These are evidence.

-- ───────────────────────────────────────────────────────────────────────────
-- certificates
-- ───────────────────────────────────────────────────────────────────────────
-- Minted by the course site only (source = 'course-site'), updatable by staff,
-- never deletable.

create table if not exists public.certificates (
  id       text primary key,
  user_id  uuid references public.users(id) on delete set null,
  source   text not null,
  passed   boolean,
  date     timestamptz,
  data     jsonb not null default '{}'::jsonb
);

create index if not exists certificates_user_idx on public.certificates (user_id);

alter table public.certificates enable row level security;

drop policy if exists certificates_read on public.certificates;
create policy certificates_read on public.certificates
  for select to authenticated using (true);

drop policy if exists certificates_insert on public.certificates;
create policy certificates_insert on public.certificates
  for insert to authenticated with check (source = 'course-site');

drop policy if exists certificates_update on public.certificates;
create policy certificates_update on public.certificates
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- No delete policy.

-- ───────────────────────────────────────────────────────────────────────────
-- course_handoffs
-- ───────────────────────────────────────────────────────────────────────────
-- One-time identity handoff tokens, app -> course site. A handoff may only be
-- minted for yourself, and a new hire may only mint one once training has
-- actually been released to them. Enforced here as well as in the client, so
-- the gate cannot be bypassed by calling the API directly — the client check is
-- convenience, this is the boundary.

create table if not exists public.course_handoffs (
  token      text primary key,
  uid        uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

alter table public.course_handoffs enable row level security;

drop policy if exists course_handoffs_read on public.course_handoffs;
create policy course_handoffs_read on public.course_handoffs
  for select to authenticated using (true);

drop policy if exists course_handoffs_insert on public.course_handoffs;
create policy course_handoffs_insert on public.course_handoffs
  for insert to authenticated
  with check (
    uid = auth.uid()
    and (
      public.current_role_name() is distinct from 'newHire'
      or exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.courses_unlocked_at is not null
      )
    )
  );

-- No update policy and no delete policy.

-- ───────────────────────────────────────────────────────────────────────────
-- course_progress
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.course_progress (
  key        text primary key,
  updated_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

alter table public.course_progress enable row level security;

drop policy if exists course_progress_read   on public.course_progress;
create policy course_progress_read   on public.course_progress for select to authenticated using (true);
drop policy if exists course_progress_insert on public.course_progress;
create policy course_progress_insert on public.course_progress for insert to authenticated with check (true);
drop policy if exists course_progress_update on public.course_progress;
create policy course_progress_update on public.course_progress for update to authenticated using (true) with check (true);

-- No delete policy.

-- ───────────────────────────────────────────────────────────────────────────
-- courses
-- ───────────────────────────────────────────────────────────────────────────
-- The training-video list behind CoursesPage.
--
-- WORTH KNOWING: this collection was never in firestore.rules, so it fell to
-- the catch-all `allow read, write: if false` and every read from that page was
-- denied. The page caught the error and rendered an empty list, which is why it
-- has always shown no courses. Giving it a real table and a real read policy
-- means it can now work — the page's behaviour changes from "silently always
-- empty" to "shows whatever rows exist", and there are currently no rows.
--
-- The list the app actually uses today comes from window.DTC_COURSES, injected
-- by the dtc-courses site; this table does not replace that.

create table if not exists public.courses (
  id          text primary key,
  title       text,
  description text,
  video_path  text,
  sort_order  integer,
  data        jsonb not null default '{}'::jsonb
);

alter table public.courses enable row level security;

drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses
  for select to authenticated using (true);
drop policy if exists courses_write on public.courses;
create policy courses_write on public.courses
  for all to authenticated
  using (public.is_admin() or public.is_dev())
  with check (public.is_admin() or public.is_dev());

-- ───────────────────────────────────────────────────────────────────────────
-- app_metadata  (was Firestore `metadata/*`)
-- ───────────────────────────────────────────────────────────────────────────
-- Two documents with deliberately different rules, so the policies key on id.
--
--   setup     — readable by anyone, even signed out (the app reads it before
--               login to decide whether first-run setup is needed).
--   ingestion — the Outlook referral watermark. Readable by staff, writable by
--               nobody from a browser: moving the watermark forwards silently
--               skips unread referrals, so it belongs to the server alone.

create table if not exists public.app_metadata (
  id         text primary key,
  updated_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

alter table public.app_metadata enable row level security;

drop policy if exists app_metadata_setup_read on public.app_metadata;
create policy app_metadata_setup_read on public.app_metadata
  for select to anon, authenticated
  using (id = 'setup');

drop policy if exists app_metadata_setup_write on public.app_metadata;
create policy app_metadata_setup_write on public.app_metadata
  for all to authenticated
  using (id = 'setup') with check (id = 'setup');

drop policy if exists app_metadata_ingestion_read on public.app_metadata;
create policy app_metadata_ingestion_read on public.app_metadata
  for select to authenticated
  using (id = 'ingestion' and public.is_staff());

-- No client write policy for 'ingestion' — service role only.

-- ───────────────────────────────────────────────────────────────────────────
-- New account bootstrap
-- ───────────────────────────────────────────────────────────────────────────
-- Firebase Auth and the Firestore `users` document were two separate writes,
-- which meant an account could exist with no profile. Postgres can close that
-- gap: a row appears in public.users the moment an auth account is created.
-- dev_access is never set here — it is granted by hand, by an existing
-- admin or dev, and never as a side effect of signing up.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'caregiver')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

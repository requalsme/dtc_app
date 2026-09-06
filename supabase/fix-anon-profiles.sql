-- Do not create a profile for an anonymous sign-in.
--
-- The course site signs in anonymously, and on_auth_user_created fired for
-- those sessions too - minting a public.users row with the default role
-- 'caregiver' and no email. Every course-site visit would therefore add a
-- phantom staff member to the roster.
--
-- That is not cosmetic. rosterForFiling() in store.js builds the "who does this
-- document belong to?" picker from public.users, so a reviewer filing an
-- inbound clinical document would see anonymous sessions listed alongside real
-- caregivers, and could file a care plan against one.
--
-- An anonymous user needs no profile: certificates, course_progress and
-- course_handoffs are keyed by their own ids, and every policy that matters
-- already answers false for a session with no profile row.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- is_anonymous is set by GoTrue on the account itself, so this is decided by
  -- the auth system rather than by anything the client can influence.
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

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

-- Clear out the phantom profiles already created this way. Identified by having
-- no email AND a matching anonymous auth account - never by email alone, so a
-- real account that simply lacks an email address is left alone.
delete from public.users u
where u.email is null
  and exists (
    select 1 from auth.users a
    where a.id = u.id and coalesce(a.is_anonymous, false)
  );

-- Run in your own Supabase project's SQL editor before enabling accounts.
create table if not exists public.flow_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null,
 version integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.flow_workspaces enable row level security;
revoke all on public.flow_workspaces from anon;
grant select, insert, update on public.flow_workspaces to authenticated;
create policy "Read own workspace" on public.flow_workspaces for select to authenticated using ((select auth.uid())=user_id);
create policy "Create own workspace" on public.flow_workspaces for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own workspace" on public.flow_workspaces for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create or replace function public.save_flow_workspace(expected_version integer,new_payload jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare next_version integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if new_payload->>'schemaVersion' is distinct from '1' or pg_column_size(new_payload)>10000000 then raise exception 'Invalid workspace'; end if;
 if expected_version=0 then
  insert into public.flow_workspaces(user_id,payload,version) values(auth.uid(),new_payload,1) on conflict do nothing returning version into next_version;
 else
  update public.flow_workspaces set payload=new_payload,version=version+1,updated_at=now()
  where user_id=auth.uid() and version=expected_version returning version into next_version;
 end if;
 if next_version is null then raise exception 'Workspace conflict'; end if;
 return next_version;
end $$;
revoke all on function public.save_flow_workspace(integer,jsonb) from public,anon;
grant execute on function public.save_flow_workspace(integer,jsonb) to authenticated;

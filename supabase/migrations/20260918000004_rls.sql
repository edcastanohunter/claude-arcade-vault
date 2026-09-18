alter table public.games enable row level security;
alter table public.profiles enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);

create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

create policy "scores_insert_own" on public.scores
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

-- security_invoker: las vistas respetan la RLS de las tablas base.
create view public.v_game_leaderboard
with (security_invoker = true) as
select
  game_id,
  profile_id,
  display_name,
  best_score,
  rank() over (partition by game_id order by best_score desc)::int as rank
from (
  select s.game_id, s.profile_id, p.display_name, max(s.score) as best_score
  from public.scores s
  join public.profiles p on p.id = s.profile_id
  group by s.game_id, s.profile_id, p.display_name
) b;

create view public.v_global_leaderboard
with (security_invoker = true) as
select
  profile_id,
  display_name,
  total_best_score,
  rank() over (order by total_best_score desc)::int as rank
from (
  select profile_id, display_name, sum(best_score)::bigint as total_best_score
  from public.v_game_leaderboard
  group by profile_id, display_name
) t;

grant select on public.v_game_leaderboard, public.v_global_leaderboard to anon, authenticated;

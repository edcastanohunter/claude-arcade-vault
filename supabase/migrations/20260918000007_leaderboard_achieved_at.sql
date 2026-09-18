-- Añade la fecha de la mejor marca a v_game_leaderboard (columna nueva al final).
create or replace view public.v_game_leaderboard
with (security_invoker = true) as
select
  game_id,
  profile_id,
  display_name,
  best_score,
  rank() over (partition by game_id order by best_score desc)::int as rank,
  achieved_at
from (
  select
    s.game_id,
    s.profile_id,
    p.display_name,
    max(s.score) as best_score,
    (array_agg(s.created_at order by s.score desc, s.created_at))[1] as achieved_at
  from public.scores s
  join public.profiles p on p.id = s.profile_id
  group by s.game_id, s.profile_id, p.display_name
) b;

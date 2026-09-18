-- Ranking parametrizado para /salon (SPEC 06).
-- Con p_game_id: mejor marca por perfil en ese juego dentro del periodo.
-- Con p_game_id nulo (global): suma de las mejores marcas por juego de cada perfil dentro del periodo.
-- El rank se calcula sobre todos los perfiles con marca en el periodo, ANTES de aplicar
-- búsqueda (p_search), filtro por perfil (p_profile_id) y paginación (p_limit/p_offset).
-- Con p_since informado la ventana es [p_since, now()]: el seed demo trae partidas con fecha
-- futura que no deben aparecer en HOY/SEMANA/MES.
-- Con p_since = null y sin filtros equivale a v_game_leaderboard / v_global_leaderboard
-- (que se conservan: las usan GameDetail y la home).
-- security invoker: se aplican las políticas RLS de lectura pública de scores y profiles.
create or replace function public.leaderboard(
  p_game_id    text        default null,
  p_since      timestamptz default null,
  p_search     text        default null,
  p_profile_id uuid        default null,
  p_limit      int         default 10,
  p_offset     int         default 0
)
returns table (
  rank         int,
  profile_id   uuid,
  display_name text,
  score        int,
  achieved_at  timestamptz,
  total_count  bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with per_game as (
    select
      s.game_id,
      s.profile_id,
      max(s.score) as best,
      (array_agg(s.created_at order by s.score desc, s.created_at))[1] as achieved_at
    from scores s
    where (p_since is null or (s.created_at >= p_since and s.created_at <= now()))
      and (p_game_id is null or s.game_id = p_game_id)
    group by s.game_id, s.profile_id
  ),
  per_profile as (
    select
      pg.profile_id,
      sum(pg.best)::int as total,
      case when p_game_id is null then null else min(pg.achieved_at) end as achieved_at
    from per_game pg
    group by pg.profile_id
  ),
  ranked as (
    select
      rank() over (order by pp.total desc)::int as rnk,
      pp.profile_id,
      p.display_name,
      pp.total,
      pp.achieved_at
    from per_profile pp
    join profiles p on p.id = pp.profile_id
  ),
  filtered as (
    select r.*, count(*) over () as total_count
    from ranked r
    where (p_profile_id is null or r.profile_id = p_profile_id)
      and (
        p_search is null
        or btrim(p_search) = ''
        or position(lower(btrim(p_search)) in lower(r.display_name)) > 0
      )
  )
  select f.rnk, f.profile_id, f.display_name, f.total, f.achieved_at, f.total_count
  from filtered f
  order by f.rnk, f.achieved_at nulls last, f.display_name, f.profile_id
  limit p_limit offset p_offset
$$;

grant execute on function public.leaderboard(text, timestamptz, text, uuid, int, int) to anon, authenticated;

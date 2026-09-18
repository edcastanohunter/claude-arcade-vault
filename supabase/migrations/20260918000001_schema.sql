-- Enum, tablas e índices base del spec 04.
create type public.game_category as enum ('ARCADE','PUZZLE','SHOOTER','VERSUS');

create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat public.game_category not null,
  cover text not null,
  color text not null check (color in ('cyan','magenta','green','yellow')),
  plays text not null,
  sort_order int not null
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.scores (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id),
  game_id text not null references public.games(id),
  score int not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_profile_idx on public.scores (profile_id);

import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/data";

// Lee el catálogo de `games` y deriva `best` (mejor marca global) de v_game_leaderboard.
export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const [games, tops] = await Promise.all([
    supabase.from("games").select("*").order("sort_order"),
    supabase.from("v_game_leaderboard").select("game_id, best_score").eq("rank", 1),
  ]);
  if (games.error) throw new Error(games.error.message);

  const best = new Map<string, number>();
  for (const t of tops.data ?? []) {
    if (t.game_id && t.best_score != null) best.set(t.game_id, Math.max(best.get(t.game_id) ?? 0, t.best_score));
  }

  return games.data.map((g) => ({
    id: g.id,
    title: g.title,
    short: g.short,
    long: g.long,
    cat: g.cat,
    cover: g.cover,
    color: g.color as Game["color"],
    plays: g.plays,
    best: best.get(g.id) ?? 0,
  }));
}

export async function getGame(id: string): Promise<Game | null> {
  const games = await getGames();
  return games.find((g) => g.id === id) ?? null;
}

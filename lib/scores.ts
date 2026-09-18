import { createClient } from "@/lib/supabase/server";
import type { ScoreRow } from "@/lib/data";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Ranking de un juego (mejor marca por perfil) desde v_game_leaderboard.
export async function getGameLeaderboard(gameId: string, limit = 10): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_game_leaderboard")
    .select("*")
    .eq("game_id", gameId)
    .order("rank")
    .limit(limit);
  if (error) throw new Error(error.message);
  return data.map(toRow);
}

// Rankings de todos los juegos, agrupados por game_id (pestañas del Salón de la Fama).
export async function getAllGameLeaderboards(perGame = 12): Promise<Record<string, ScoreRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_game_leaderboard").select("*").order("rank");
  if (error) throw new Error(error.message);

  const byGame: Record<string, ScoreRow[]> = {};
  for (const r of data) {
    if (!r.game_id) continue;
    (byGame[r.game_id] ??= []).push(toRow(r));
  }
  // Se conservan las filas del top y, aparte, la del usuario se busca en el cliente por profileId.
  return Object.fromEntries(Object.entries(byGame).map(([g, rows]) => [g, rows.slice(0, perGame)]));
}

// Suma de mejores marcas por perfil desde v_global_leaderboard.
export async function getGlobalLeaderboard(limit = 12): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_global_leaderboard").select("*").order("rank").limit(limit);
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    rank: r.rank ?? 0,
    name: r.display_name ?? "",
    score: r.total_best_score ?? 0,
    date: "—",
    profileId: r.profile_id ?? undefined,
  }));
}

// Mejor marca de un perfil en cada juego (para la fila "tu mejor marca").
export async function getProfileBests(profileId: string): Promise<Record<string, ScoreRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_game_leaderboard").select("*").eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.filter((r) => r.game_id).map((r) => [r.game_id!, toRow(r)]));
}

// Últimas partidas registradas (ticker de la home).
export async function getRecentScores(limit = 7) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("game_id, score, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data.map((r) => ({ gameId: r.game_id, score: r.score, name: r.profiles?.display_name ?? "" }));
}

function toRow(r: {
  rank: number | null;
  display_name: string | null;
  best_score: number | null;
  achieved_at: string | null;
  profile_id: string | null;
}): ScoreRow {
  return {
    rank: r.rank ?? 0,
    name: r.display_name ?? "",
    score: r.best_score ?? 0,
    date: fmtDate(r.achieved_at),
    profileId: r.profile_id ?? undefined,
  };
}

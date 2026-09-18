import { createClient } from "@/lib/supabase/server";
import type { Game, ScoreRow } from "@/lib/data";
import type { Database } from "@/lib/supabase/database.types";
import {
  DETAIL_PAGE_SIZE,
  GLOBAL_VIEW,
  PREVIEW_SIZE,
  periodSince,
  type LeaderboardPage,
  type Period,
  type SalonParams,
} from "@/lib/salon";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Ranking de un juego (mejor marca por perfil) desde v_game_leaderboard.
export async function getGameLeaderboard(
  gameId: string,
  limit = 10,
): Promise<ScoreRow[]> {
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

// Suma de mejores marcas por perfil desde v_global_leaderboard.
export async function getGlobalLeaderboard(limit = 12): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_global_leaderboard")
    .select("*")
    .order("rank")
    .limit(limit);
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    rank: r.rank ?? 0,
    name: r.display_name ?? "",
    score: r.total_best_score ?? 0,
    date: "—",
    profileId: r.profile_id ?? undefined,
  }));
}

// ===== SPEC 06: ranking parametrizado vía RPC `leaderboard` =====

type LeaderboardRpcRow =
  Database["public"]["Functions"]["leaderboard"]["Returns"][number];

function toRpcRow(r: LeaderboardRpcRow): ScoreRow {
  return {
    rank: r.rank,
    name: r.display_name,
    score: r.score,
    date: fmtDate(r.achieved_at), // null en el ranking global -> "—"
    profileId: r.profile_id,
  };
}

async function callLeaderboard(
  args: Database["public"]["Functions"]["leaderboard"]["Args"],
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard", args);
  if (error) throw new Error(error.message);
  return data;
}

// Tabla de una vista de detalle (GLOBAL o un juego): página `params.pagina` de 10 filas.
export async function getLeaderboard(
  params: SalonParams,
): Promise<LeaderboardPage> {
  const data = await callLeaderboard({
    p_game_id:
      params.juego && params.juego !== GLOBAL_VIEW ? params.juego : undefined,
    p_since: periodSince(params.periodo) ?? undefined,
    p_search: params.q || undefined,
    p_limit: DETAIL_PAGE_SIZE,
    p_offset: (params.pagina - 1) * DETAIL_PAGE_SIZE,
  });
  return {
    rows: data.map(toRpcRow),
    total: Number(data[0]?.total_count ?? 0),
    page: params.pagina,
    pageSize: DETAIL_PAGE_SIZE,
  };
}

// Top 5 de cada juego para la rejilla (una llamada por juego, en paralelo).
export async function getBoardPreviews(
  games: Game[],
  periodo: Period,
): Promise<Record<string, LeaderboardPage>> {
  const since = periodSince(periodo) ?? undefined;
  const pages = await Promise.all(
    games.map(async (g) => {
      const data = await callLeaderboard({
        p_game_id: g.id,
        p_since: since,
        p_limit: PREVIEW_SIZE,
        p_offset: 0,
      });
      const page: LeaderboardPage = {
        rows: data.map(toRpcRow),
        total: Number(data[0]?.total_count ?? 0),
        page: 1,
        pageSize: PREVIEW_SIZE,
      };
      return [g.id, page] as const;
    }),
  );
  return Object.fromEntries(pages);
}

// Fila «TU MEJOR MARCA»: mejor marca del perfil en un juego dentro del periodo, con su rango real.
export async function getProfileBest(
  gameId: string,
  periodo: Period,
  profileId: string,
): Promise<ScoreRow | null> {
  const data = await callLeaderboard({
    p_game_id: gameId,
    p_since: periodSince(periodo) ?? undefined,
    p_profile_id: profileId,
    p_limit: 1,
  });
  return data[0] ? toRpcRow(data[0]) : null;
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
  return data.map((r) => ({
    gameId: r.game_id,
    score: r.score,
    name: r.profiles?.display_name ?? "",
  }));
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

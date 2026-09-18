import { redirect } from "next/navigation";
import { getGames } from "@/lib/games";
import { getCurrentUser } from "@/lib/auth";
import { getBoardPreviews, getLeaderboard, getProfileBest } from "@/lib/scores";
import { GLOBAL_VIEW, parseSalonParams, salonHref } from "@/lib/salon";
import HallOfFame from "@/components/HallOfFame";

export default async function SalonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [games, raw, user] = await Promise.all([
    getGames(),
    searchParams,
    getCurrentUser(),
  ]);
  const params = parseSalonParams(
    raw,
    games.map((g) => g.id),
  );

  if (params.juego === null) {
    const previews = await getBoardPreviews(games, params.periodo);
    return <HallOfFame games={games} params={params} previews={previews} />;
  }

  const wantsMine = params.juego !== GLOBAL_VIEW && user?.profileId;
  const [detail, mine] = await Promise.all([
    getLeaderboard(params),
    wantsMine
      ? getProfileBest(params.juego, params.periodo, user.profileId!)
      : null,
  ]);
  // Página fuera de rango: vuelve a la primera conservando periodo y búsqueda.
  if (detail.rows.length === 0 && params.pagina > 1) {
    redirect(salonHref({ ...params, pagina: 1 }));
  }

  return (
    <HallOfFame
      games={games}
      params={params}
      detail={detail}
      mine={mine}
      meName={user?.name}
    />
  );
}

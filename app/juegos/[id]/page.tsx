import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import { getGameLeaderboard } from "@/lib/scores";
import GameDetail from "@/components/GameDetail";

export default async function GameDetailPage({ params }: PageProps<"/juegos/[id]">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GameDetail game={game} scores={await getGameLeaderboard(game.id, 10)} />;
}

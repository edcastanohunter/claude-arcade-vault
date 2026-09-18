import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import { getCurrentUser } from "@/lib/auth";
import GamePlayer from "@/components/GamePlayer";

export default async function GamePlayerPage({ params }: PageProps<"/juegos/[id]/jugar">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const user = await getCurrentUser();

  return <GamePlayer game={game} userName={user?.name ?? null} />;
}

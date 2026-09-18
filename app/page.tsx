import { getGames } from "@/lib/games";
import { getGlobalLeaderboard, getRecentScores } from "@/lib/scores";
import Home from "@/components/Home";

export default async function Page() {
  const [games, recent, topPlayers] = await Promise.all([getGames(), getRecentScores(7), getGlobalLeaderboard(5)]);
  return <Home games={games} recent={recent} topPlayers={topPlayers} />;
}

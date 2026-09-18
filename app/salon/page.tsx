import { getGames } from "@/lib/games";
import { getCurrentUser } from "@/lib/auth";
import { getAllGameLeaderboards, getGlobalLeaderboard, getProfileBests } from "@/lib/scores";
import HallOfFame from "@/components/HallOfFame";

export default async function SalonPage() {
  const [games, byGame, global, user] = await Promise.all([
    getGames(),
    getAllGameLeaderboards(12),
    getGlobalLeaderboard(12),
    getCurrentUser(),
  ]);
  const me = user?.profileId ? { name: user.name, bests: await getProfileBests(user.profileId) } : null;

  return <HallOfFame games={games} boards={{ ...byGame, global }} me={me} />;
}

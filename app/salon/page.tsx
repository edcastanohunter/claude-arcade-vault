import { getGames } from "@/lib/games";
import HallOfFame from "@/components/HallOfFame";

export default async function SalonPage() {
  return <HallOfFame games={await getGames()} />;
}

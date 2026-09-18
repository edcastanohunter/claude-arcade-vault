import { getGames } from "@/lib/games";
import Home from "@/components/Home";

export default async function Page() {
  return <Home games={await getGames()} />;
}

import { getGames } from "@/lib/games";
import Library from "@/components/Library";

export default async function Biblioteca() {
  return <Library games={await getGames()} />;
}

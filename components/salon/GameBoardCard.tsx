import Link from "next/link";
import type { Game } from "@/lib/data";
import type { LeaderboardPage, Period } from "@/lib/salon";
import { salonHref } from "@/lib/salon";

interface Props {
  game: Game;
  board: LeaderboardPage;
  periodo: Period;
}

// Tabla top de un juego para la rejilla de /salon; el color de acento viene del propio juego.
export default function GameBoardCard({ game, board, periodo }: Props) {
  return (
    <section className={"board-card c-" + game.color}>
      <header className="board-head">
        <h2>{game.title}</h2>
        <Link
          href={salonHref({ juego: game.id, periodo })}
          className="board-more"
        >
          VER TODO
        </Link>
      </header>
      {board.rows.length === 0 ? (
        <p className="board-empty">SIN PUNTUACIONES EN ESTE PERIODO</p>
      ) : (
        <ol className="board-rows">
          {board.rows.map((r) => (
            <li
              key={r.profileId ?? r.name}
              className={r.rank <= 3 ? "top" + r.rank : undefined}
            >
              <span className="rk">#{String(r.rank).padStart(2, "0")}</span>
              <span className="pl">{r.name}</span>
              <span className="sc">{r.score.toLocaleString("es-ES")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

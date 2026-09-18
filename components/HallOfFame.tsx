import Link from "next/link";
import type { Game, ScoreRow } from "@/lib/data";
import {
  GLOBAL_VIEW,
  MAX_QUERY_LENGTH,
  PERIODS,
  salonHref,
  type LeaderboardPage,
  type SalonParams,
} from "@/lib/salon";
import GameBoardCard from "@/components/salon/GameBoardCard";
import LeaderboardTable from "@/components/salon/LeaderboardTable";

interface Props {
  games: Game[];
  params: SalonParams;
  previews?: Record<string, LeaderboardPage>; // vista TODOS: top 5 por juego
  detail?: LeaderboardPage; // vista GLOBAL o de un juego
  mine?: ScoreRow | null; // «TU MEJOR MARCA» en la vista de un juego
  meName?: string;
}

const fmt = (n: number) => n.toLocaleString("es-ES");

export default function HallOfFame({
  games,
  params,
  previews,
  detail,
  mine,
  meName,
}: Props) {
  const { juego, periodo, q, pagina } = params;
  const isGlobal = juego === GLOBAL_VIEW;
  const game = games.find((g) => g.id === juego);
  // q solo sobrevive al cambiar entre vistas de detalle; pagina siempre vuelve a 1.
  const viewHref = (target: string | null) =>
    salonHref({ juego: target, periodo, q: target ? q : "" });
  const periodHref = (p: (typeof PERIODS)[number]) =>
    salonHref({ juego, periodo: p, q });

  const rows = detail?.rows ?? [];
  const showPodium = rows.length > 0 && !q && pagina === 1;
  const totalPages = Math.max(
    1,
    Math.ceil((detail?.total ?? 0) / (detail?.pageSize ?? 10)),
  );

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <nav className="hall-tabs" aria-label="Vista del ranking">
        <Link
          href={viewHref(null)}
          className={"chip" + (juego === null ? " active" : "")}
        >
          TODOS
        </Link>
        <Link
          href={viewHref(GLOBAL_VIEW)}
          className={"chip" + (isGlobal ? " active" : "")}
        >
          GLOBAL
        </Link>
        {games.map((g) => (
          <Link
            key={g.id}
            href={viewHref(g.id)}
            className={"chip" + (juego === g.id ? " active" : "")}
          >
            {g.title}
          </Link>
        ))}
      </nav>

      <nav className="hall-period" aria-label="Periodo">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={periodHref(p)}
            className={"chip" + (periodo === p ? " active" : "")}
          >
            {p.toUpperCase()}
          </Link>
        ))}
      </nav>

      {juego !== null && (
        // key={q}: al navegar con enlaces el campo se remonta y refleja la búsqueda de la URL.
        <form
          key={q}
          method="get"
          action="/salon"
          className="hall-search"
          role="search"
        >
          <input type="hidden" name="juego" value={juego} />
          {periodo !== "siempre" && (
            <input type="hidden" name="periodo" value={periodo} />
          )}
          <label className="av-search">
            <span className="ico">⌕</span>
            <input
              name="q"
              defaultValue={q}
              maxLength={MAX_QUERY_LENGTH}
              placeholder="Buscar un jugador…"
              aria-label="Buscar jugador"
            />
          </label>
          <button type="submit" className="btn">
            BUSCAR
          </button>
        </form>
      )}

      {juego === null ? (
        <div className="board-grid">
          {games.map((g) => (
            <GameBoardCard
              key={g.id}
              game={g}
              periodo={periodo}
              board={
                previews?.[g.id] ?? { rows: [], total: 0, page: 1, pageSize: 5 }
              }
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--ink-faint)",
          }}
        >
          {q ? "SIN RESULTADOS" : "SIN PUNTUACIONES EN ESTE PERIODO"}
        </div>
      ) : (
        <>
          {showPodium && (
            <div className="podium">
              {rows[1] && (
                <div className="podium-slot silver">
                  <div className="rank-num">02</div>
                  <div className="name">{rows[1].name}</div>
                  <div className="score">{fmt(rows[1].score)}</div>
                  <div className="date">{rows[1].date}</div>
                </div>
              )}
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div
                  className="rank-num"
                  style={{ fontSize: 36, marginTop: 4 }}
                >
                  01
                </div>
                <div className="name">{rows[0].name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {fmt(rows[0].score)}
                </div>
                <div className="date">{rows[0].date}</div>
              </div>
              {rows[2] && (
                <div className="podium-slot bronze">
                  <div className="rank-num">03</div>
                  <div className="name">{rows[2].name}</div>
                  <div className="score">{fmt(rows[2].score)}</div>
                  <div className="date">{rows[2].date}</div>
                </div>
              )}
            </div>
          )}
          <LeaderboardTable
            rows={rows}
            isGlobal={isGlobal}
            mine={
              mine && game && meName
                ? { gameTitle: game.title, name: meName, row: mine }
                : null
            }
          />
          {totalPages > 1 && (
            <nav className="hall-pager" aria-label="Paginación">
              {pagina > 1 ? (
                <Link
                  href={salonHref({ juego, periodo, q, pagina: pagina - 1 })}
                  className="btn ghost"
                >
                  ANTERIOR
                </Link>
              ) : (
                <span className="btn ghost disabled" aria-disabled="true">
                  ANTERIOR
                </span>
              )}
              <span className="pixel hall-pager-info">
                PÁGINA {pagina} DE {totalPages}
              </span>
              {pagina < totalPages ? (
                <Link
                  href={salonHref({ juego, periodo, q, pagina: pagina + 1 })}
                  className="btn ghost"
                >
                  SIGUIENTE
                </Link>
              ) : (
                <span className="btn ghost disabled" aria-disabled="true">
                  SIGUIENTE
                </span>
              )}
            </nav>
          )}
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

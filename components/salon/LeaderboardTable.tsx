import type { ScoreRow } from "@/lib/data";

interface Props {
  rows: ScoreRow[];
  isGlobal: boolean;
  // Fila «TU MEJOR MARCA» (solo vistas de un juego, con sesión).
  mine?: { gameTitle: string; name: string; row: ScoreRow } | null;
}

const fmt = (n: number) => n.toLocaleString("es-ES");
const pad = (n: number) => String(n).padStart(2, "0");

export default function LeaderboardTable({ rows, isGlobal, mine }: Props) {
  return (
    <div className="hall-table">
      <div className="th">
        <div>RANGO</div>
        <div>JUGADOR</div>
        <div>{isGlobal ? "TOTAL" : "PUNTUACIÓN"}</div>
        <div>FECHA</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.profileId ?? r.name + i}
          className={
            "tr" +
            (r.rank === 1
              ? " top1"
              : r.rank === 2
                ? " top2"
                : r.rank === 3
                  ? " top3"
                  : "")
          }
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="rk">#{pad(r.rank)}</div>
          <div className="pl">{r.name}</div>
          <div className="sc">{fmt(r.score)}</div>
          <div className="dt">{r.date}</div>
        </div>
      ))}
      {mine && (
        <>
          <div className="tr you-label">
            ▸ TU MEJOR MARCA EN {mine.gameTitle}
          </div>
          <div
            className="tr you"
            style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
          >
            <div className="rk" style={{ color: "var(--yellow)" }}>
              #{pad(mine.row.rank)}
            </div>
            <div className="pl" style={{ color: "var(--yellow)" }}>
              {mine.name}
            </div>
            <div
              className="sc"
              style={{
                color: "var(--yellow)",
                textShadow: "0 0 6px rgba(245,255,0,0.5)",
              }}
            >
              {fmt(mine.row.score)}
            </div>
            <div className="dt">{mine.row.date}</div>
          </div>
        </>
      )}
    </div>
  );
}

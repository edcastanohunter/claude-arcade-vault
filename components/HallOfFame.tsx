"use client";

import { useState } from "react";
import Link from "next/link";
import type { Game, ScoreRow } from "@/lib/data";

const GLOBAL = "global";

interface Props {
  games: Game[];
  boards: Record<string, ScoreRow[]>; // por game_id, más GLOBAL (v_global_leaderboard)
  me: { name: string; bests: Record<string, ScoreRow> } | null;
}

export default function HallOfFame({ games, boards, me }: Props) {
  const [tab, setTab] = useState(GLOBAL);

  const rows = boards[tab] ?? [];
  const game = games.find((g) => g.id === tab);
  const mine = me && tab !== GLOBAL ? me.bests[tab] : null;
  const podium = (i: number) => rows[i];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        <button className={"chip" + (tab === GLOBAL ? " active" : "")} onClick={() => setTab(GLOBAL)}>
          GLOBAL
        </button>
        {games.map((g) => (
          <button key={g.id} className={"chip" + (tab === g.id ? " active" : "")} onClick={() => setTab(g.id)}>
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--ink-faint)" }}>AÚN NO HAY PUNTUACIONES.</div>
      ) : (
        <div className="podium">
          {podium(1) && (
            <div className="podium-slot silver">
              <div className="rank-num">02</div>
              <div className="name">{podium(1).name}</div>
              <div className="score">{podium(1).score.toLocaleString("es-ES")}</div>
              <div className="date">{podium(1).date}</div>
            </div>
          )}
          <div className="podium-slot gold">
            <div className="pixel" style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}>
              CAMPEÓN
            </div>
            <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
              01
            </div>
            <div className="name">{podium(0).name}</div>
            <div className="score" style={{ fontSize: 20 }}>
              {podium(0).score.toLocaleString("es-ES")}
            </div>
            <div className="date">{podium(0).date}</div>
          </div>
          {podium(2) && (
            <div className="podium-slot bronze">
              <div className="rank-num">03</div>
              <div className="name">{podium(2).name}</div>
              <div className="score">{podium(2).score.toLocaleString("es-ES")}</div>
              <div className="date">{podium(2).date}</div>
            </div>
          )}
        </div>
      )}

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>{tab === GLOBAL ? "TOTAL" : "PUNTUACIÓN"}</div>
          <div>FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.profileId ?? r.name + i}
            className={"tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {me && mine && game && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(mine.rank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {me.name}
              </div>
              <div className="sc" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>
                {mine.score.toLocaleString("es-ES")}
              </div>
              <div className="dt">{mine.date}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

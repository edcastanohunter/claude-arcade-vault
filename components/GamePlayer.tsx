"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Game } from "@/lib/data";
import { saveScore } from "@/app/juegos/actions";
import TouchControls from "@/components/games/TouchControls";
import { GAME_COMPONENTS } from "@/lib/games/registry";
import type { GameHandle, GameStats, SfxEvent } from "@/lib/games/types";
import {
  createAudioEngine,
  readMuted,
  subscribeMuted,
  writeMuted,
  type AudioEngine,
} from "@/lib/games/asteroids/audio";

type SaveState = "idle" | "saved" | "guest" | "error";

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

export default function GamePlayer({
  game,
  userName,
}: {
  game: Game;
  userName: string | null;
}) {
  const RealGame = GAME_COMPONENTS[game.id];
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [engineLevel, setEngineLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [runId, setRunId] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const handleRef = useRef<GameHandle | null>(null);
  const muted = useSyncExternalStore(subscribeMuted, readMuted, () => false);
  const audioRef = useRef<AudioEngine | null>(null);
  const overRef = useRef(false); // garantiza un único guardado por partida
  const name = userName ?? "INVITADO";

  useEffect(() => {
    if (RealGame || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [RealGame, over, paused]);

  // Sonido del juego real: el AudioContext se crea en el primer gesto.
  useEffect(() => {
    if (!RealGame) return;
    const audio = createAudioEngine();
    audio.setMuted(readMuted());
    audioRef.current = audio;
    return () => {
      audio.destroy();
      audioRef.current = null;
    };
  }, [RealGame]);

  const toggleMuted = () => {
    const next = !muted;
    audioRef.current?.setMuted(next);
    writeMuted(next);
  };

  // Teclado del juego real: P/Esc pausan y las flechas/Espacio no hacen scroll
  // (ni activan el botón enfocado). Solo mientras no hay modal abierto.
  useEffect(() => {
    if (!RealGame || over) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.includes(e.code)) e.preventDefault();
      if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat)
        setPaused((p) => !p);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [RealGame, over]);

  const level = RealGame ? engineLevel : 1 + Math.floor(score / 2500);

  const endGame = async (finalScore: number) => {
    if (overRef.current) return;
    overRef.current = true;
    setScore(finalScore);
    setOver(true);
    if (!userName) return setSaveState("guest");
    const res = await saveScore(game.id, finalScore);
    setSaveState(res.ok ? "saved" : res.reason === "guest" ? "guest" : "error");
  };
  const onStats = (s: GameStats) => {
    setScore(s.score);
    setLives(s.lives);
    setEngineLevel(s.level);
  };
  const onSfx = (e: SfxEvent) => audioRef.current?.play(e);
  const onFinClick = () => {
    if (RealGame) handleRef.current?.end();
    else endGame(score);
  };
  const restart = () => {
    overRef.current = false;
    setScore(0);
    setLives(3);
    setEngineLevel(1);
    setPaused(false);
    setOver(false);
    setSaveState("idle");
    setRunId((n) => n + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          {RealGame && (
            <button className="btn" onClick={toggleMuted}>
              {muted ? "SONIDO" : "MUTE"}
            </button>
          )}
          <button className="btn magenta" onClick={onFinClick}>
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {RealGame ? (
            <RealGame
              callbacks={{ onStats, onGameOver: endGame, onSfx }}
              paused={paused}
              runId={runId}
              handleRef={handleRef}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {RealGame && <TouchControls handleRef={handleRef} />}

      {RealGame && (
        <div className="controls-legend">
          <span>
            <kbd>← →</kbd>rotar
          </span>
          <span>
            <kbd>↑</kbd>propulsar
          </span>
          <span>
            <kbd>ESPACIO</kbd>disparar
          </span>
          <span>
            <kbd>P</kbd>pausa
          </span>
        </div>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {saveState === "saved" && (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveState === "guest" && (
              <div className="toast-saved" style={{ color: "var(--yellow)" }}>
                ▸ <Link href="/login">INICIA SESIÓN</Link> PARA GUARDAR TU
                PUNTUACIÓN_
              </div>
            )}
            {saveState === "error" && (
              <div className="toast-saved" style={{ color: "var(--magenta)" }}>
                ▸ NO SE PUDO GUARDAR LA PUNTUACIÓN_
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

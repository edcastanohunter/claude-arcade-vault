"use client";

import { useEffect, useRef } from "react";
import { createAsteroidsGame } from "@/lib/games/asteroids/engine";
import type {
  GameCallbacks,
  GameComponentProps,
  GameHandle,
} from "@/lib/games/types";

const W = 800;
const H = 600;

export default function AsteroidsCanvas({
  callbacks,
  paused,
  runId,
  handleRef,
}: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacksRef = useRef<GameCallbacks>(callbacks);
  const engineRef = useRef<GameHandle | null>(null);
  const runIdRef = useRef(runId);

  // Siempre los callbacks más recientes, sin recrear el motor.
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  // Monta el motor; el cleanup cancela el rAF y retira los listeners
  // (también cubre el doble montaje del modo estricto).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createAsteroidsGame(canvas, {
      onStats: (s) => callbacksRef.current.onStats(s),
      onGameOver: (n) => callbacksRef.current.onGameOver(n),
      onSfx: (e) => callbacksRef.current.onSfx?.(e),
    });
    engineRef.current = handle;
    handleRef.current = handle;
    return () => {
      handle.destroy();
      engineRef.current = null;
      handleRef.current = null;
    };
  }, [handleRef]);

  // Pausa real del loop.
  useEffect(() => {
    if (paused) engineRef.current?.pause();
    else engineRef.current?.resume();
  }, [paused]);

  // Nueva partida cuando cambia runId.
  useEffect(() => {
    if (runIdRef.current === runId) return;
    runIdRef.current = runId;
    engineRef.current?.restart();
  }, [runId]);

  return (
    <canvas ref={canvasRef} className="game-canvas" width={W} height={H} />
  );
}

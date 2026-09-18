import type { RefObject } from "react";

export interface GameStats {
  score: number;
  lives: number;
  level: number;
}

export type SfxEvent =
  | "shoot"
  | "explode-large"
  | "explode-medium"
  | "explode-small"
  | "powerup"
  | "ship-death";

export interface GameCallbacks {
  onStats: (s: GameStats) => void;
  onGameOver: (finalScore: number) => void;
  onSfx?: (e: SfxEvent) => void;
}

export interface GameHandle {
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void; // termina la partida con la puntuación actual (botón FIN)
  setKey(
    code: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "Space",
    down: boolean,
  ): void; // teclado táctil
  destroy(): void; // cancela rAF y retira listeners
}

export interface GameComponentProps {
  callbacks: GameCallbacks;
  paused: boolean;
  runId: number; // cambia para reiniciar la partida
  handleRef: RefObject<GameHandle | null>;
}

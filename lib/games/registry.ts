import type { ComponentType } from "react";
import AsteroidsCanvas from "@/components/games/AsteroidsCanvas";
import type { GameComponentProps } from "./types";

// id del juego → componente real. Los ids ausentes usan el simulador de GamePlayer.
export const GAME_COMPONENTS: Record<
  string,
  ComponentType<GameComponentProps>
> = {
  asteroids: AsteroidsCanvas,
};

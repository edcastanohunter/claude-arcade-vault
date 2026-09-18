"use client";

import { useSyncExternalStore, type PointerEvent, type RefObject } from "react";
import type { GameHandle } from "@/lib/games/types";

type Code = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "Space";

const QUERY = "(pointer: coarse)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

const BUTTONS: { code: Code; label: string; aria: string; wide?: boolean }[] = [
  { code: "ArrowLeft", label: "◀", aria: "Rotar a la izquierda" },
  { code: "ArrowRight", label: "▶", aria: "Rotar a la derecha" },
  { code: "ArrowUp", label: "▲", aria: "Propulsar" },
  { code: "Space", label: "DISPARAR", aria: "Disparar", wide: true },
];

export default function TouchControls({
  handleRef,
}: {
  handleRef: RefObject<GameHandle | null>;
}) {
  const coarse = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  if (!coarse) return null;

  const press = (code: Code, down: boolean) =>
    handleRef.current?.setKey(code, down);

  return (
    <div className="touch-controls" onContextMenu={(e) => e.preventDefault()}>
      {BUTTONS.map(({ code, label, aria, wide }) => (
        <button
          key={code}
          type="button"
          className={`btn touch-btn${wide ? " wide" : ""}`}
          aria-label={aria}
          onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            press(code, true);
          }}
          onPointerUp={() => press(code, false)}
          onPointerCancel={() => press(code, false)}
          onLostPointerCapture={() => press(code, false)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
